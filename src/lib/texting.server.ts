// Server-only: send texts and let the Salon Agent answer texts for a salon.
import { tw } from "./phone.server";
import { tool } from "ai";
import { z } from "zod";
import { writeReply } from "./ai.server";

type Admin = any;
const OPT_OUT = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|start|unstop|help|info)\s*$/i;

export async function sendSms(sb: Admin, o: { salonId: string; from: string; to: string; body: string; sentBy: "agent" | "staff"; userId?: string }) {
  const r = await tw(`/Messages.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: o.from, To: o.to, Body: o.body }),
  });
  const j = r.json as { sid?: string; status?: string } | null;
  if (r.status < 200 || r.status >= 300 || !j?.sid) return false;
  await sb.from("messages").upsert({
    salon_id: o.salonId, provider_ref: j.sid, sent_at: new Date().toISOString(), direction: "outbound",
    customer_phone: o.to, body: o.body, status: j.status ?? "queued", sent_by: o.sentBy, sender_user: o.userId ?? null,
  }, { onConflict: "provider_ref" });
  return true;
}

/** Called after an inbound text is saved. Replies only when the thread is in Salon Agent mode. */
export async function agentReply(sb: Admin, salonId: string, from: string, customer: string, lastBody: string) {
  if (OPT_OUT.test(lastBody)) return; // carrier keywords are handled by the phone provider
  const { data: t } = await sb.from("sms_threads").select("ai_enabled,customer_name").eq("salon_id", salonId).eq("customer_phone", customer).maybeSingle();
  if (t && !t.ai_enabled) return;
  const [{ data: s }, { data: svc }, { data: hist }] = await Promise.all([
    sb.from("salons").select("name,address,phone,website,hours,cancellation_policy,deposit_policy,walk_ins,agent_id,timezone").eq("id", salonId).single(),
    sb.from("services").select("name,price,minutes,is_addon").eq("salon_id", salonId).order("position").limit(60),
    sb.from("messages").select("direction,body").eq("salon_id", salonId).eq("customer_phone", customer).order("sent_at", { ascending: false }).limit(20),
  ]);
  if (!s?.agent_id) return; // receptionist not built
  const menu = (svc ?? []).map((v: any) => `- ${v.name}${v.is_addon ? " (add-on)" : ""}: $${v.price}, ${v.minutes} min`).join("\n");
  const system = `You are the Salon Agent, the text-message receptionist for ${s.name || "this salon"}.
Reply by SMS: friendly, short (under 300 characters), plain text, no markdown.
Salon facts (only use these; never invent prices, times, or availability):
Address: ${s.address || "not provided"}
Phone: ${s.phone || "not provided"}
Website / booking: ${s.website || "not provided"}
Hours: ${s.hours || "not provided"}
Walk-ins: ${s.walk_ins ? "welcome" : "by appointment only"}
Cancellation policy: ${s.cancellation_policy || "not provided"}
Deposit policy: ${s.deposit_policy || "not provided"}
Services:
${menu || "not provided"}
Today is ${new Date().toLocaleDateString("en-US", { timeZone: s.timezone, weekday: "long", year: "numeric", month: "long", day: "numeric" })} (salon time).
You can book, reschedule and cancel with your tools. Always check_availability before offering times, offer two or three, and only book once the client clearly agrees. Ask for their name before booking. If nothing fits, offer the waitlist. Never confirm a booking unless the tool returned ok. If the client is upset or asks for a person, say a team member will follow up shortly.`;
  const messages = ((hist ?? []) as { direction: string; body: string }[]).reverse().map((m) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.body })) as never;
  let text = "";
  const bk = await import("./booking.server");
  const ad = await (await import("./booking-adapters.server")).adapterFor(sb, salonId);
  const tools = {
    check_availability: tool({ description: "Find open times", inputSchema: z.object({ date: z.string().nullable().describe("YYYY-MM-DD or null for next 7 days"), service: z.string().nullable(), technician: z.string().nullable() }),
      execute: (a) => ad.checkAvailability({ date: a.date ?? undefined, service: a.service ?? undefined, staff: a.technician ?? undefined }) }),
    book_appointment: tool({ description: "Book an agreed open time (exact start from check_availability)", inputSchema: z.object({ service: z.string(), start: z.string(), technician: z.string().nullable(), client_name: z.string() }),
      execute: (a) => ad.createBooking({ service: a.service, start: a.start, technician: a.technician ?? undefined, client_name: a.client_name, client_phone: customer, source: "ai_text" }) }),
    find_my_appointments: tool({ description: "This client's upcoming appointments", inputSchema: z.object({}), execute: () => ad.getBookings(customer) }),
    reschedule_appointment: tool({ description: "Move an appointment to a new open time", inputSchema: z.object({ appointment_id: z.string(), service: z.string(), start: z.string(), technician: z.string().nullable() }),
      execute: (a) => ad.rescheduleBooking(a.appointment_id, { service: a.service, start: a.start, technician: a.technician ?? undefined, client_name: t?.customer_name ?? "", client_phone: customer, source: "ai_text" }) }),
    cancel_appointment: tool({ description: "Cancel after the client confirms", inputSchema: z.object({ appointment_id: z.string() }), execute: (a) => ad.cancelBooking(a.appointment_id, customer) }),
    add_to_waitlist: tool({ description: "Add to waitlist", inputSchema: z.object({ client_name: z.string(), service: z.string().nullable(), technician: z.string().nullable(), preferred: z.string().nullable() }),
      execute: (a) => ad.addWaitlist({ client_name: a.client_name, client_phone: customer, service: a.service ?? undefined, technician: a.technician ?? undefined, preferred: a.preferred ?? undefined, source: "ai_text" }) }),
  };
  try { text = (await writeReply(system, messages, tools)).slice(0, 480); } catch (e) { console.error("agent text reply failed", e); return; }
  if (text) await sendSms(sb, { salonId, from, to: customer, body: text, sentBy: "agent" });
}
