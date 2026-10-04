// Square Appointments booking adapter. Each salon books into its own connected Square
// location; availability comes only from Square. The salon is resolved by the caller from
// the verified per-salon tool key — never from agent input.
import { addDays, localDate } from "./availability";
import { addWaitlist } from "./booking.server";
import { getSquareConnection, SquareReconnectRequired, squareApi, type SquareConn } from "./square-client.server";
import type { BookingAdapter, BookInput } from "./booking-adapters.server";

const digits = (p: string) => p.replace(/\D/g, "").slice(-10);
const e164 = (p: string) => { const d = p.replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : d ? `+${d}` : ""; };

function fail(e: unknown) {
  if (e instanceof SquareReconnectRequired) return { error: "calendar_reconnect_required" as const, say: "The salon's Square connection needs to be renewed. Offer to take a message so the salon can call back to book." };
  console.error("square adapter", (e as Error)?.message ?? e);
  return { error: "calendar_unavailable" as const, say: "I couldn't reach the salon's booking system just now. Would you like me to take your number so the salon can call you back?" };
}

export async function squareAdapter(sb: any, salonId: string): Promise<BookingAdapter | null> {
  const conn = await getSquareConnection(salonId).catch(() => null);
  if (!conn || !conn.locationId) return null;
  const [{ data: salon }, { data: services }, { data: staff }] = await Promise.all([
    sb.from("salons").select("timezone").eq("id", salonId).single(),
    sb.from("services").select("id,name,price,minutes,square_variation_id,description,deposit_cents,is_addon").eq("salon_id", salonId).eq("archived", false).neq("square_variation_id", "").order("position"),
    sb.from("staff").select("id,name,square_team_member_id").eq("salon_id", salonId).eq("active", true).neq("square_team_member_id", ""),
  ]);
  const tz = salon?.timezone || "America/Phoenix";
  const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const pick = (n?: string) => (!n ? null : (services ?? []).find((s: any) => s.name.toLowerCase() === n.toLowerCase() || norm(s.name).startsWith(norm(n))) ?? null);
  const tech = (n?: string) => (!n ? null : (staff ?? []).find((s: any) => norm(s.name).startsWith(norm(n))) ?? null);
  const techName = (id: string) => (staff ?? []).find((s: any) => s.square_team_member_id === id)?.name ?? "any available technician";

  async function search(c: SquareConn, variationId: string, from: string, to: string, teamId?: string) {
    const r = await squareApi(c, "/v2/bookings/availability/search", {
      method: "POST",
      body: JSON.stringify({ query: { filter: {
        location_id: c.locationId,
        start_at_range: { start_at: from, end_at: to },
        segment_filters: [{ service_variation_id: variationId, ...(teamId ? { team_member_id_filter: { any: [teamId] } } : {}) }],
      } } }),
    });
    return (r?.availabilities ?? []) as Array<{ start_at: string; appointment_segments: any[] }>;
  }
  // Square needs at least a 24h search window, so search the whole day around the requested time.
  const dayWindow = (iso: string) => {
    const t = Date.parse(iso);
    return { from: new Date(Math.max(Date.now() + 60000, t - 12 * 3600000)).toISOString(), to: new Date(t + 12 * 3600000).toISOString() };
  };
  async function findCustomer(c: SquareConn, name: string, phone: string) {
    const p = e164(phone);
    if (p) {
      const r = await squareApi(c, "/v2/customers/search", { method: "POST", body: JSON.stringify({ query: { filter: { phone_number: { exact: p } } }, limit: 1 }) }).catch(() => null);
      const id = r?.customers?.[0]?.id;
      if (id) return id as string;
    }
    const [given, ...rest] = name.trim().split(/\s+/);
    const r = await squareApi(c, "/v2/customers", { method: "POST", body: JSON.stringify({ idempotency_key: crypto.randomUUID(), given_name: given || "Guest", family_name: rest.join(" ") || undefined, phone_number: p || undefined }) });
    return r.customer.id as string;
  }

  return {
    getServices: async () => ({ services: (services ?? []).map((s: any) => ({ name: s.name, price: Number(s.price), minutes: s.minutes, is_addon: s.is_addon, description: s.description, deposit_cents: s.deposit_cents })) }),
    getStaff: async () => ({ technicians: (staff ?? []).map((s: any) => ({ name: s.name })) }),
    checkAvailability: async (q) => {
      const svc = pick(q.service) ?? (services ?? [])[0];
      if (!svc) return { error: "no_service" as const, say: "Which service would you like to book?" };
      const t = tech(q.staff);
      const day = q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : localDate(new Date(), tz);
      const from = new Date(Math.max(Date.now() + 60000, Date.parse(`${day}T00:00:00Z`) - 14 * 3600000)).toISOString();
      const to = new Date(Date.parse(`${addDays(day, q.date ? 1 : 7)}T12:00:00Z`)).toISOString();
      try {
        const av = await search(conn, svc.square_variation_id, from, to, t?.square_team_member_id);
        const wanted = q.date ? av.filter((a) => localDate(new Date(a.start_at), tz) === day) : av;
        return { slots: wanted.slice(0, 6).map((a) => ({ start: a.start_at, technician: techName(a.appointment_segments?.[0]?.team_member_id ?? "") })) };
      } catch (e) { return fail(e); }
    },
    createBooking: async (i: BookInput) => {
      const svc = pick(i.service);
      if (!svc) return { error: "no_service" as const, say: `I don't have "${i.service}" on the menu. I can read you the closest options.` };
      if (!Number.isFinite(Date.parse(i.start))) return { error: "bad_start" as const, say: "That time didn't come through clearly." };
      const t = tech(i.technician);
      try {
        const w = dayWindow(i.start);
        const av = (await search(conn, svc.square_variation_id, w.from, w.to, t?.square_team_member_id)).find((a) => Date.parse(a.start_at) === Date.parse(i.start));
        if (!av) return { error: "taken" as const, say: "That time isn't open in the salon's calendar. I can offer the next openings." };
        const customerId = await findCustomer(conn, i.client_name, i.client_phone);
        const r = await squareApi(conn, "/v2/bookings", {
          method: "POST",
          body: JSON.stringify({ idempotency_key: crypto.randomUUID(), booking: {
            start_at: av.start_at, location_id: conn.locationId, customer_id: customerId,
            customer_note: i.notes?.slice(0, 400) || undefined,
            appointment_segments: av.appointment_segments.map((s) => ({ team_member_id: s.team_member_id, service_variation_id: s.service_variation_id, service_variation_version: s.service_variation_version, duration_minutes: s.duration_minutes })),
          } }),
        });
        const b = r.booking;
        const teamId = av.appointment_segments?.[0]?.team_member_id ?? "";
        const staffRow = (staff ?? []).find((s: any) => s.square_team_member_id === teamId);
        const mins = av.appointment_segments.reduce((n: number, s: any) => n + Number(s.duration_minutes ?? 0), 0) || svc.minutes;
        const { data: row, error } = await sb.from("appointments").insert({
          salon_id: salonId, service_id: svc.id, service_name: svc.name, price: svc.price, staff_id: staffRow?.id ?? null,
          client_name: i.client_name, client_phone: i.client_phone,
          starts_at: b.start_at, ends_at: new Date(Date.parse(b.start_at) + mins * 60000).toISOString(),
          status: "booked", source: i.source, notes: i.notes ?? "", provider: "square", provider_event_id: b.id,
        }).select("id").single();
        if (error) { console.error("square appt row", error.message); return { ok: true as const, say: "You're booked in the salon's Square calendar." }; }
        return { ok: true as const, booking_id: row.id, technician: techName(teamId) };
      } catch (e) { return fail(e); }
    },
    rescheduleBooking: async (id: string, i: BookInput) => {
      const { data: appt } = await sb.from("appointments").select("provider_event_id,provider,client_phone").eq("id", id).eq("salon_id", salonId).single();
      if (!appt || appt.provider !== "square" || !appt.provider_event_id) return { error: "not_found" as const, say: "I couldn't find that appointment in the salon's Square calendar." };
      if (digits(appt.client_phone) !== digits(i.client_phone)) return { error: "not_authorized" as const, say: "That appointment isn't under the number you're calling from." };
      try {
        const cur = (await squareApi(conn, `/v2/bookings/${encodeURIComponent(appt.provider_event_id)}`)).booking;
        const seg = cur.appointment_segments?.[0];
        const w = dayWindow(i.start);
        const av = (await search(conn, seg.service_variation_id, w.from, w.to, seg.team_member_id)).find((a) => Date.parse(a.start_at) === Date.parse(i.start));
        if (!av) return { error: "taken" as const, say: "That time isn't open. I can offer the next openings." };
        const r = await squareApi(conn, `/v2/bookings/${encodeURIComponent(cur.id)}`, {
          method: "PUT",
          body: JSON.stringify({ idempotency_key: crypto.randomUUID(), booking: { version: cur.version, start_at: av.start_at, appointment_segments: av.appointment_segments.map((s) => ({ team_member_id: s.team_member_id, service_variation_id: s.service_variation_id, service_variation_version: s.service_variation_version, duration_minutes: s.duration_minutes })) } }),
        });
        const mins = av.appointment_segments.reduce((n: number, s: any) => n + Number(s.duration_minutes ?? 0), 0) || 30;
        await sb.from("appointments").update({ starts_at: r.booking.start_at, ends_at: new Date(Date.parse(r.booking.start_at) + mins * 60000).toISOString() }).eq("id", id);
        return { ok: true as const };
      } catch (e) { return fail(e); }
    },
    cancelBooking: async (id: string, phone: string) => {
      const { data: appt } = await sb.from("appointments").select("provider_event_id,provider,client_phone").eq("id", id).eq("salon_id", salonId).single();
      if (!appt) return { error: "not_found" as const, say: "I couldn't find that appointment." };
      if (digits(appt.client_phone) !== digits(phone)) return { error: "not_authorized" as const, say: "That appointment isn't under the number you're calling from." };
      if (appt.provider === "square" && appt.provider_event_id) {
        try {
          const cur = (await squareApi(conn, `/v2/bookings/${encodeURIComponent(appt.provider_event_id)}`)).booking;
          if (!String(cur.status).startsWith("CANCELLED")) {
            await squareApi(conn, `/v2/bookings/${encodeURIComponent(cur.id)}/cancel`, { method: "POST", body: JSON.stringify({ idempotency_key: crypto.randomUUID(), booking_version: cur.version }) });
          }
        } catch (e) { return fail(e); }
      }
      await sb.from("appointments").update({ status: "cancelled" }).eq("id", id);
      return { ok: true as const };
    },
    getBookings: async (phone: string) => {
      const { data } = await sb.from("appointments").select("id,service_name,client_phone,starts_at,status").eq("salon_id", salonId).eq("status", "booked").gte("starts_at", new Date().toISOString()).order("starts_at");
      return (data ?? []).filter((a: any) => digits(a.client_phone) === digits(phone)).map(({ client_phone: _p, ...a }: any) => a);
    },
    addWaitlist: (i) => addWaitlist(sb, salonId, i),
  };
}
