// Google Calendar booking adapter. Each salon location books straight into the Google
// Calendar its owner connected (one location = one calendar), using the salon's business
// hours as the working window and Google events as busy time. The salon is resolved from
// the verified per-salon tool key by the caller — never from agent input.
import { appUserReconnectRequired, callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { getSalonConnection, type SalonConnection } from "./gcal-connections.server";
import { addDays, localDate, openSlots, type Hours, type Rules } from "./availability";
import { addWaitlist } from "./booking.server";
import { GOOGLE_SCOPES } from "./gcal.functions";
import type { BookingAdapter, BookInput } from "./booking-adapters.server";

const GATEWAY = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

/** Thrown when the salon's Google grant expired and an owner must reconnect. */
export class GoogleReconnectRequired extends Error {
  constructor() { super("gcal_reconnect_required"); }
}

type Busy = { start: number; end: number };

async function gcalFetch(conn: SalonConnection, path: string, init?: RequestInit) {
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY,
    connectionAPIKey: conn.connectionKey,
    connectorId: CONNECTOR_ID,
    path,
    init,
    requiredScopes: GOOGLE_SCOPES,
  });
}

async function busyRanges(conn: SalonConnection, from: string, to: string): Promise<Busy[]> {
  const res = await gcalFetch(
    conn,
    `/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events?timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}&singleEvents=true&orderBy=startTime&maxResults=250`,
  );
  if (await appUserReconnectRequired(res)) throw new GoogleReconnectRequired();
  if (!res.ok) throw new Error(`Google Calendar request failed [${res.status}]: ${await res.text()}`);
  const data = (await res.json()) as { items?: Array<{ start?: any; end?: any; status?: string }> };
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled" && e.start)
    .map((e) => {
      const s = e.start?.dateTime ?? `${e.start?.date}T00:00:00Z`;
      const en = e.end?.dateTime ?? `${e.end?.date ?? e.start?.date}T23:59:59Z`;
      return { start: Date.parse(s), end: Date.parse(en) };
    })
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));
}

function adapterError(e: unknown) {
  if (e instanceof GoogleReconnectRequired) {
    return { error: "calendar_reconnect_required" as const, say: "Your Google Calendar needs to be reconnected — a salon owner can do that on the Salon Agent page." };
  }
  console.error("gcal adapter", e instanceof Error ? e.message : e);
  return { error: "calendar_unavailable" as const, say: "I couldn't reach your Google Calendar just now. Would you like me to take your number so the salon can call you back?" };
}

export async function googleAdapter(sb: any, salonId: string): Promise<BookingAdapter | null> {
  const conn = await getSalonConnection(salonId).catch(() => null);
  if (!conn) return null;
  const [{ data: salon }, { data: services }] = await Promise.all([
    sb.from("salons").select("timezone,buffer_min,lead_min,horizon_days,hours").eq("id", salonId).single(),
    sb.from("services").select("id,name,price,minutes,days,deposit_cents").eq("salon_id", salonId).eq("archived", false).order("position"),
  ]);
  if (!salon) return null;
  const rules = salon as unknown as Rules;
  const hours = (salon.hours ?? {}) as Hours;
  // The calendar itself is the "technician": its working window is the salon's business hours.
  const staff = [{ id: "google", name: conn.calendarSummary || "Google Calendar", hours, service_ids: [] as string[], active: true }];
  const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const pick = (needle?: string) => (!needle ? null : services?.find((s: any) => s.name.toLowerCase() === needle.toLowerCase() || norm(s.name).startsWith(norm(needle))) ?? null);
  const busyFor = async (days: string[]): Promise<Busy[]> => {
    const last = days[days.length - 1] ?? days[0]!;
    const from = new Date(Date.parse(`${days[0]!}T00:00:00Z`) - 86400000).toISOString();
    const to = new Date(Date.parse(`${addDays(last, 1)}T00:00:00Z`)).toISOString();
    return busyRanges(conn, from, to);
  };
  const toBusy = (busy: Busy[]) =>
    busy.map((b) => ({ staff_id: "google", starts_at: new Date(b.start).toISOString(), ends_at: new Date(b.end).toISOString() }));

  return {
    getServices: async () => (services ?? []).map((s: any) => ({ id: s.id, name: s.name, price_cents: s.price, deposit_cents: s.deposit_cents ?? null })),
    getStaff: async () => [],
    checkAvailability: async (q) => {
      const svc = pick(q.service);
      const day = q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : localDate(new Date(), rules.timezone);
      const days = q.date ? 1 : 7;
      let busy: Busy[];
      try {
        busy = await busyFor(Array.from({ length: days }, (_, i) => addDays(day, i)));
      } catch (e) {
        return adapterError(e);
      }
      const slots: { start: string; end: string }[] = [];
      for (let i = 0; i < days; i++) {
        slots.push(
          ...openSlots({
            date: addDays(day, i),
            staff,
            busy: toBusy(busy),
            minutes: svc?.minutes ?? 30,
            rules,
            now: new Date(),
            step: 30,
          }).map((s) => ({ start: s.start, end: s.end })),
        );
      }
      return { slots: slots.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6) };
    },
    createBooking: async (i: BookInput) => {
      const svc = pick(i.service);
      if (!svc) return { error: "no_service" as const, say: `I don't have "${i.service}" on the menu. I can read you the closest options.` };
      const start = Date.parse(i.start);
      if (!Number.isFinite(start)) return { error: "bad_start" as const, say: "That time didn't come through clearly." };
      const end = start + (svc.minutes ?? 30) * 60000;
      const day = localDate(new Date(start), rules.timezone);
      // Re-verify the slot against business hours and the live calendar before writing.
      let slotOk = false;
      try {
        const busy = await busyFor([day]);
        slotOk = openSlots({ date: day, staff, busy: toBusy(busy), minutes: svc.minutes ?? 30, rules, now: new Date(), step: 5 }).some((s) => Date.parse(s.start) === start);
      } catch (e) {
        return adapterError(e);
      }
      if (!slotOk) return { error: "taken" as const, say: "That time just filled up — the next openings I have are available." };

      const desc = ["Booked by Salon Pro Agent", `Client: ${i.client_name}`, `Phone: ${i.client_phone}`, i.notes ? `Notes: ${i.notes}` : ""].filter(Boolean).join("\n");
      let eventId: string;
      try {
        const res = await gcalFetch(conn, `/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: `${svc.name} — ${i.client_name}`,
            description: desc,
            start: { dateTime: new Date(start).toISOString() },
            end: { dateTime: new Date(end).toISOString() },
          }),
        });
        if (await appUserReconnectRequired(res)) throw new GoogleReconnectRequired();
        if (!res.ok) throw new Error(`Google Calendar event create failed [${res.status}]: ${await res.text()}`);
        const ev = (await res.json()) as { id?: string };
        if (!ev.id) throw new Error("Google Calendar event create returned no id");
        eventId = ev.id;
      } catch (e) {
        return adapterError(e);
      }
      const { data: row, error } = await sb
        .from("appointments")
        .insert({
          salon_id: salonId,
          service_id: svc.id,
          service_name: svc.name,
          price: svc.price,
          client_name: i.client_name,
          client_phone: i.client_phone,
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(end).toISOString(),
          status: "booked",
          source: i.source,
          notes: i.notes ?? null,
          provider: "google",
          provider_event_id: eventId,
        })
        .select("id")
        .single();
      if (error) {
        console.error("gcal booking row", error.message);
        return { error: "save_failed" as const, say: "Your appointment is on the calendar, but I had trouble saving a copy on our side. The salon can see it in Google Calendar." };
      }
      return { ok: true as const, booking_id: row.id };
    },
    rescheduleBooking: async (id: string, i: { start: string }) => {
      const { data: appt } = await sb.from("appointments").select("provider_event_id,service_id,starts_at,status").eq("id", id).eq("salon_id", salonId).single();
      if (!appt) return { error: "not_found" as const, say: "I couldn't find that appointment." };
      if (!appt.provider_event_id) return { error: "not_google" as const, say: "That appointment isn't on your Google Calendar, so I can't move it there." };
      const start = Date.parse(i.start);
      if (!Number.isFinite(start)) return { error: "bad_start" as const, say: "That time didn't come through clearly." };
      const { data: svc } = await sb.from("services").select("minutes").eq("id", appt.service_id).single();
      const minutes = svc?.minutes ?? 30;
      const end = start + minutes * 60000;
      const day = localDate(new Date(start), rules.timezone);
      try {
        const busy = (await busyFor([day])).filter((b) => !(b.end <= Date.parse(appt.starts_at) || b.start >= Date.parse(appt.starts_at) + minutes * 60000));
        const slotOk = openSlots({ date: day, staff, busy: toBusy(busy), minutes, rules, now: new Date(), step: 5 }).some((s) => Date.parse(s.start) === start);
        if (!slotOk) return { error: "taken" as const, say: "That time just filled up — the next openings I have are available." };
        const res = await gcalFetch(conn, `/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events/${encodeURIComponent(appt.provider_event_id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: { dateTime: new Date(start).toISOString() }, end: { dateTime: new Date(end).toISOString() } }),
        });
        if (await appUserReconnectRequired(res)) throw new GoogleReconnectRequired();
        if (!res.ok) throw new Error(`Google Calendar event update failed [${res.status}]: ${await res.text()}`);
      } catch (e) {
        return adapterError(e);
      }
      await sb.from("appointments").update({ starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() }).eq("id", id);
      return { ok: true as const };
    },
    cancelBooking: async (id: string, phone: string) => {
      const { data: appt } = await sb.from("appointments").select("client_phone,provider_event_id,status").eq("id", id).eq("salon_id", salonId).single();
      if (!appt) return { error: "not_found" as const, say: "I couldn't find that appointment." };
      if (appt.client_phone.replace(/\D/g, "").slice(-10) !== phone.replace(/\D/g, "").slice(-10)) {
        return { error: "not_authorized" as const, say: "That appointment isn't under the number you're calling from." };
      }
      if (appt.provider_event_id) {
        try {
          const res = await gcalFetch(conn, `/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events/${encodeURIComponent(appt.provider_event_id)}`, { method: "DELETE" });
          if (await appUserReconnectRequired(res)) throw new GoogleReconnectRequired();
          if (!res.ok && res.status !== 410 && res.status !== 404) {
            throw new Error(`Google Calendar event delete failed [${res.status}]: ${await res.text()}`);
          }
        } catch (e) {
          return adapterError(e);
        }
      }
      await sb.from("appointments").update({ status: "cancelled" }).eq("id", id);
      return { ok: true as const };
    },
    getBookings: async (phone: string) => {
      const digits = phone.replace(/\D/g, "").slice(-10);
      const { data } = await sb
        .from("appointments")
        .select("id,service_name,client_phone,starts_at,status")
        .eq("salon_id", salonId)
        .eq("status", "booked")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at");
      return (data ?? []).filter((a: any) => a.client_phone && a.client_phone.replace(/\D/g, "").slice(-10) === digits);
    },
    addWaitlist: (i) => addWaitlist(sb, salonId, i),
  };
}
