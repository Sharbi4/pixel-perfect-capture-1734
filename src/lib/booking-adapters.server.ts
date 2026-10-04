// One booking interface for every agent tool. The salon is always resolved by the server from the
// trusted per-salon tool key, never from anything the agent sends. Each salon's booking_provider picks
// the adapter: Salon Pro Scheduling, or the salon's own connected Google Calendar. Unconnected providers
// refuse to answer rather than guess, so the agent can never claim availability or a booking that no
// calendar confirmed.
import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import * as native from "./booking.server";

type Admin = typeof supabaseAdmin;
type Src = "ai_call" | "ai_text";
export type BookInput = { service: string; start: string; technician?: string | undefined; client_name: string; client_phone: string; source: Src; call_ref?: string | undefined; notes?: string | undefined };

export interface BookingAdapter {
  getServices(): Promise<unknown>;
  getStaff(): Promise<unknown>;
  checkAvailability(q: { date?: string | undefined; service?: string | undefined; staff?: string | undefined }): Promise<unknown>;
  createBooking(i: BookInput): Promise<unknown>;
  rescheduleBooking(id: string, i: BookInput): Promise<unknown>;
  cancelBooking(id: string, phone: string): Promise<unknown>;
  getBookings(phone: string): Promise<unknown>;
  addWaitlist(i: Parameters<typeof native.addWaitlist>[2]): Promise<unknown>;
}

function salonPro(sb: Admin, salonId: string): BookingAdapter {
  return {
    getServices: async () => {
      const { data } = await sb.from("services").select("name,price,minutes,is_addon,description,deposit_cents,days").eq("salon_id", salonId).eq("archived", false).order("position");
      return { services: (data ?? []).map((s) => ({ ...s, price: Number(s.price) })) };
    },
    getStaff: async () => {
      const [{ data: st }, { data: sv }] = await Promise.all([
        sb.from("staff").select("name,service_ids").eq("salon_id", salonId).eq("active", true).order("position"),
        sb.from("services").select("id,name").eq("salon_id", salonId).eq("archived", false),
      ]);
      const names = new Map((sv ?? []).map((s) => [s.id, s.name]));
      return { technicians: (st ?? []).map((s) => ({ name: s.name, services: s.service_ids.length ? s.service_ids.map((i) => names.get(i)).filter(Boolean) : "all services" })) };
    },
    checkAvailability: (q) => native.findSlots(sb, salonId, q),
    createBooking: (i) => native.book(sb, salonId, i),
    rescheduleBooking: (id, i) => native.book(sb, salonId, { ...i, reschedule_id: id }),
    cancelBooking: (id, phone) => native.cancel(sb, salonId, phone, id),
    getBookings: (phone) => native.lookup(sb, salonId, phone),
    addWaitlist: (i) => native.addWaitlist(sb, salonId, i),
  };
}

// Square, Google, Outlook, Acuity, Mindbody and Calendly adapters plug in here once their
// per-salon connections exist. Until then they never invent data.
function notConnected(sb: Admin, salonId: string): BookingAdapter {
  const no = async () => ({ error: "calendar_not_connected", say: "I can't see the salon's calendar right now. Offer to take a message so the salon can call back to book." });
  const base = salonPro(sb, salonId);
  return { getServices: base.getServices, getStaff: base.getStaff, checkAvailability: no, createBooking: no, rescheduleBooking: no, cancelBooking: no, getBookings: no, addWaitlist: base.addWaitlist };
}

export async function adapterFor(sb: Admin, salonId: string): Promise<BookingAdapter> {
  const { data } = await sb.from("salons").select("booking_provider").eq("id", salonId).single();
  const provider = data?.booking_provider ?? "salon_pro";
  // Google: books into the calendar the salon owner connected on the Salon Agent page.
  if (provider === "google") {
    const { googleAdapter } = await import("./gcal-adapter.server");
    const g = await googleAdapter(sb, salonId);
    if (g) return g;
    return notConnected(sb, salonId);
  }
  // Square: books into the Square Appointments calendar the salon owner connected.
  if (provider === "square") {
    const { squareAdapter } = await import("./square-adapter.server");
    const s = await squareAdapter(sb, salonId);
    if (s) return s;
    return notConnected(sb, salonId);
  }
  return provider === "salon_pro" ? salonPro(sb, salonId) : notConnected(sb, salonId);
}
