// Server-only booking logic used by the voice agent tools and the text agent.
import { createHmac, timingSafeEqual } from "crypto";
import { openSlots, addDays, localDate, fmtDay, fmtTime, type StaffLite, type Rules } from "./availability";

type Admin = any;

/** Per-salon key for the voice agent's booking tools, derived from the shared webhook secret. */
export function toolKey(salonId: string): string | null {
  const s = process.env["TWILIO_WEBHOOK_SECRET"];
  return s ? createHmac("sha256", s).update(`agent-tools:${salonId}`).digest("hex").slice(0, 40) : null;
}
export function checkToolKey(salonId: string, k: string): boolean {
  const want = toolKey(salonId);
  if (!want) return false;
  const a = Buffer.from(k), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function toolsUrl(salonId: string): string | null {
  const raw = process.env["PUBLIC_APP_ORIGIN"]; const k = toolKey(salonId);
  if (!raw || !k) return null;
  try { const u = new URL(raw); return u.protocol === "https:" ? `${u.origin}/api/public/agent-tools?salon=${salonId}&k=${k}` : null; } catch { return null; }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function pick<T extends { name: string }>(list: T[], q?: string | null): T | null {
  if (!q) return null;
  const n = norm(q);
  return list.find((x) => norm(x.name) === n) ?? list.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name))) ?? null;
}
export const e164 = (p: string) => { const d = (p ?? "").replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : p?.startsWith("+") ? p : ""; };

async function context(sb: Admin, salonId: string) {
  const [{ data: salon }, { data: staff }, { data: services }] = await Promise.all([
    sb.from("salons").select("timezone,buffer_min,lead_min,horizon_days,confirm_texts,phone_number,name,address").eq("id", salonId).single(),
    sb.from("staff").select("id,name,service_ids,hours,active").eq("salon_id", salonId).eq("active", true).order("position"),
    sb.from("services").select("id,name,price,minutes,days,deposit_cents").eq("salon_id", salonId).eq("archived", false),
  ]);
  return { salon, staff: (staff ?? []) as StaffLite[], services: (services ?? []) as { id: string; name: string; price: number; minutes: number; days: number[]; deposit_cents: number }[] };
}

async function busy(sb: Admin, salonId: string, from: string, to: string, ignore?: string) {
  const [{ data: a }, { data: off }] = await Promise.all([
    sb.from("appointments").select("id,staff_id,starts_at,ends_at").eq("salon_id", salonId).in("status", ["booked", "confirmed"]).lt("starts_at", to).gt("ends_at", from),
    sb.from("staff_time_off").select("staff_id,starts_at,ends_at").eq("salon_id", salonId).lt("starts_at", to).gt("ends_at", from),
  ]);
  return [...((a ?? []) as any[]).filter((x) => x.id !== ignore), ...((off ?? []) as any[])];
}

export async function findSlots(sb: Admin, salonId: string, q: { date?: string | undefined; service?: string | undefined; staff?: string | undefined; ignore?: string | undefined }) {
  const { salon, staff, services } = await context(sb, salonId);
  if (!salon) return { error: "salon_not_found" };
  if (!staff.length) return { error: "The salon hasn't set up its team calendar yet. Offer to have someone call back to book." };
  const svc = pick(services, q.service);
  if (q.service && !svc) return { error: `Unknown service. Services: ${services.map((s) => s.name).join(", ")}` };
  const who = pick(staff, q.staff);
  const rules = salon as Rules;
  const start = q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : localDate(new Date(), rules.timezone);
  const days = q.date ? 1 : 7;
  const from = new Date(Date.parse(`${start}T00:00:00Z`) - 86_400_000).toISOString();
  const to = new Date(Date.parse(`${addDays(start, days)}T00:00:00Z`) + 86_400_000).toISOString();
  const b = await busy(sb, salonId, from, to, q.ignore);
  const slots = [];
  for (let i = 0; i < days && slots.length < 12; i++) {
    if (svc?.days?.length && !svc.days.includes(weekday(addDays(start, i)))) continue;
    slots.push(...openSlots({ date: addDays(start, i), staff, busy: b, minutes: svc?.minutes ?? 30, rules, now: new Date(), serviceId: svc?.id, staffId: who?.id, step: 30 }).slice(0, 6));
  }
  return {
    service: svc?.name ?? null, minutes: svc?.minutes ?? 30, technician: who?.name ?? null,
    slots: slots.slice(0, 12).map((s) => ({ start: s.start, technician: s.staff_name, label: `${fmtDay(s.start, rules.timezone)} at ${fmtTime(s.start, rules.timezone)} with ${s.staff_name}` })),
  };
}

export async function book(sb: Admin, salonId: string, i: { service: string; start: string; technician?: string | undefined; client_name: string; client_phone: string; source: "ai_call" | "ai_text"; call_ref?: string | undefined; notes?: string | undefined; reschedule_id?: string | undefined }) {
  const { salon, staff, services } = await context(sb, salonId);
  if (!salon) return { error: "salon_not_found" };
  const svc = pick(services, i.service);
  if (!svc) return { error: "Unknown service." };
  const phone = e164(i.client_phone);
  if (!phone) return { error: "Need the client's phone number." };
  const day = localDate(new Date(i.start), salon.timezone);
  const ctx = await busy(sb, salonId, new Date(Date.parse(i.start) - 86_400_000).toISOString(), new Date(Date.parse(i.start) + 86_400_000).toISOString(), i.reschedule_id);
  const wanted = pick(staff, i.technician);
  const slot = openSlots({ date: day, staff, busy: ctx, minutes: svc.minutes, rules: salon, now: new Date(), serviceId: svc.id, staffId: wanted?.id, step: 5 })
    .find((s) => s.start === new Date(i.start).toISOString());
  if (!slot) return { error: "That time is no longer open. Check availability again." };
  const row = {
    salon_id: salonId, staff_id: slot.staff_id, service_id: svc.id, service_name: svc.name, price: svc.price,
    client_name: (i.client_name ?? "").slice(0, 120), client_phone: phone, starts_at: slot.start, ends_at: slot.end,
    source: i.source, notes: (i.notes ?? "").slice(0, 2000), status: "booked",
  } as Record<string, unknown>;
  if (i.call_ref) {
    const { data: c } = await sb.from("calls").select("id").eq("provider_ref", i.call_ref).maybeSingle();
    if (c) row["call_id"] = c.id;
  }
  let id: string;
  if (i.reschedule_id) {
    const { data, error } = await sb.from("appointments").update({ ...row, updated_at: new Date().toISOString() }).eq("id", i.reschedule_id).eq("salon_id", salonId).eq("client_phone", phone).in("status", ["booked", "confirmed"]).select("id").maybeSingle();
    if (error || !data) return { error: error?.code === "23P01" ? "That time was just taken." : "Couldn't find that appointment." };
    id = data.id;
  } else {
    const { data, error } = await sb.from("appointments").insert(row).select("id").single();
    if (error) return { error: error.code === "23P01" ? "That time was just taken. Check availability again." : "Couldn't save the booking." };
    id = data.id;
  }
  const when = `${fmtDay(slot.start, salon.timezone)} at ${fmtTime(slot.start, salon.timezone)}`;
  if (i.source !== "ai_text") {
    const { sendAutomation } = await import("./texting.server");
    const ok = await sendAutomation(sb, salonId, i.reschedule_id ? "reschedule_confirmation" : "appointment_confirmation", phone,
      { service: svc.name, tech: slot.staff_name, when, address: salon.address ? `${salon.address}.` : "" });
    if (ok) await sb.from("appointments").update({ text_confirmed: true, confirmation_sent_at: new Date().toISOString() }).eq("id", id);
  }
  return { ok: true, appointment_id: id, summary: `${svc.name} with ${slot.staff_name} on ${when}` };
}

export async function lookup(sb: Admin, salonId: string, phone: string) {
  const p = e164(phone);
  if (!p) return { appointments: [] };
  const { data: s } = await sb.from("salons").select("timezone").eq("id", salonId).single();
  const { data } = await sb.from("appointments").select("id,service_name,starts_at,status,staff:staff(name)").eq("salon_id", salonId).eq("client_phone", p).in("status", ["booked", "confirmed"]).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5);
  return { appointments: (data ?? []).map((a: any) => ({ id: a.id, label: `${a.service_name} with ${a.staff?.name ?? "any technician"} on ${fmtDay(a.starts_at, s?.timezone ?? "UTC")} at ${fmtTime(a.starts_at, s?.timezone ?? "UTC")}` })) };
}

export async function cancel(sb: Admin, salonId: string, phone: string, id: string, opts?: { notify?: boolean }) {
  const p = e164(phone);
  const { data } = await sb.from("appointments").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("salon_id", salonId).eq("client_phone", p).in("status", ["booked", "confirmed"]).select("id,service_name,starts_at,source").maybeSingle();
  if (data && data.source !== "ai_text" && opts?.notify !== false) {
    const { data: s } = await sb.from("salons").select("timezone").eq("id", salonId).single();
    const tz = s?.timezone ?? "UTC";
    const { sendAutomation } = await import("./texting.server");
    await sendAutomation(sb, salonId, "cancellation_confirmation", p, { service: data.service_name, when: `${fmtDay(data.starts_at, tz)} at ${fmtTime(data.starts_at, tz)}` });
  }
  return data ? { ok: true } : { error: "Couldn't find that appointment for this phone number." };
}

export async function addWaitlist(sb: Admin, salonId: string, i: { client_name: string; client_phone: string; service?: string | undefined; technician?: string | undefined; preferred?: string | undefined; source: string }) {
  const { staff } = await context(sb, salonId);
  const { error } = await sb.from("waitlist").insert({ salon_id: salonId, client_name: (i.client_name ?? "").slice(0, 120), client_phone: e164(i.client_phone), service_name: i.service ?? "", staff_id: pick(staff, i.technician)?.id ?? null, preferred: (i.preferred ?? "").slice(0, 300), source: i.source });
  return error ? { error: "Couldn't add to the waitlist." } : { ok: true };
}
