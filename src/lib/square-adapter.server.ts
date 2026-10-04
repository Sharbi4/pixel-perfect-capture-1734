// Booking adapter for salons whose booking_provider is 'square'. Every call uses the salon's
// own encrypted Square token (refreshed server-side) and its chosen location. If anything about
// the connection fails, the adapter returns null so the agent says it can't see the calendar
// rather than inventing availability.
import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { BookInput, BookingAdapter } from "./booking-adapters.server";
import * as native from "./booking.server";
import { squareClientFor, type SquareApi } from "./square-client.server";

type Admin = typeof supabaseAdmin;

type CatalogItem = {
  id: string;
  item_data?: {
    name?: string;
    variations?: { id: string; item_variation_data?: { name?: string; price_money?: { amount?: number }; service_duration?: number } }[];
  };
};

type ServiceEntry = { name: string; variationId: string; price: number; minutes: number };

async function listServices(api: SquareApi): Promise<ServiceEntry[]> {
  const catalog = (await api("/v2/catalog/list?types=ITEM")) as { objects?: CatalogItem[] };
  const out: ServiceEntry[] = [];
  for (const item of catalog.objects ?? []) {
    const itemName = item.item_data?.name?.trim();
    if (!itemName) continue;
    for (const variation of item.item_data?.variations ?? []) {
      const v = variation.item_variation_data;
      out.push({
        name: v?.name && v.name !== "Regular" ? `${itemName} — ${v.name}` : itemName,
        variationId: variation.id,
        price: (v?.price_money?.amount ?? 0) / 100,
        minutes: v?.service_duration ? Math.round(v.service_duration / 60000) : 60,
      });
    }
  }
  return out;
}

async function findCustomer(api: SquareApi, phone: string, name: string): Promise<string> {
  const found = (await api("/v2/customers/search", {
    method: "POST",
    body: JSON.stringify({ query: { filter: { phone_number: { exact: phone } } } }),
  })) as { customers?: { id: string }[] };
  if (found.customers?.[0]) return found.customers[0].id;
  const [givenName, ...rest] = name.trim().split(/\s+/);
  const created = (await api("/v2/customers", {
    method: "POST",
    body: JSON.stringify({ given_name: givenName || name, family_name: rest.join(" ") || undefined, phone_number: phone }),
  })) as { customer?: { id: string } };
  if (!created.customer?.id) throw new Error("Couldn't create the Square customer.");
  return created.customer.id;
}

export async function squareAdapter(sb: Admin, salonId: string): Promise<BookingAdapter | null> {
  const client = await squareClientFor(salonId);
  if (!client) return null;
  const { api, locationId } = client;

  return {
    getServices: async () => {
      const services = await listServices(api);
      return { services: services.map((s) => ({ name: s.name, price: s.price, minutes: s.minutes })) };
    },
    getStaff: async () => {
      const res = (await api("/v2/team-members/search", {
        method: "POST",
        body: JSON.stringify({ query: { filter: { location_ids: [locationId], status: "ACTIVE" } } }),
      })) as { team_members?: { given_name?: string; family_name?: string }[] };
      return { technicians: (res.team_members ?? []).map((t) => ({ name: [t.given_name, t.family_name].filter(Boolean).join(" "), services: "all services" })) };
    },
    checkAvailability: async (q) => {
      const services = await listServices(api);
      const match = q.service ? services.find((s) => s.name.toLowerCase().includes(q.service!.toLowerCase())) : undefined;
      const day = q.date ? new Date(`${q.date}T00:00:00`) : new Date();
      const start = new Date(day); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const res = (await api("/v2/bookings/availability/search", {
        method: "POST",
        body: JSON.stringify({
          query: {
            filter: {
              location_id: locationId,
              start_at_range: { start_at: start.toISOString(), end_at: end.toISOString() },
              segment_filters: match ? [{ service_variation_id: match.variationId }] : [],
            },
          },
        }),
      })) as { availabilities?: { start_at?: string }[] };
      const slots = (res.availabilities ?? []).map((a) => a.start_at).filter(Boolean).slice(0, 12);
      return { date: q.date, service: match?.name ?? q.service, slots };
    },
    createBooking: async (i: BookInput) => {
      const services = await listServices(api);
      const match = services.find((s) => s.name.toLowerCase().includes(i.service.toLowerCase()));
      if (!match) return { error: "service_not_found", say: `I couldn't find "${i.service}" on the salon's Square menu. Offer to take a message.` };
      const customerId = await findCustomer(api, i.client_phone, i.client_name);
      const res = (await api("/v2/bookings", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          booking: {
            location_id: locationId,
            customer_id: customerId,
            start_at: i.start,
            customer_note: i.notes ?? "",
            appointment_segments: [{ duration_minutes: match.minutes, service_variation_id: match.variationId, team_member_id: undefined }],
          },
        }),
      })) as { booking?: { id: string; start_at?: string } };
      if (!res.booking?.id) throw new Error("Square didn't confirm the booking.");
      return { booked: true, id: res.booking.id, service: match.name, start: res.booking.start_at ?? i.start, provider: "square" };
    },
    rescheduleBooking: async (id, i) => {
      const res = (await api(`/v2/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify({ booking: { start_at: i.start } }),
      })) as { booking?: { id: string; start_at?: string } };
      if (!res.booking?.id) throw new Error("Square didn't confirm the reschedule.");
      return { booked: true, id: res.booking.id, start: res.booking.start_at ?? i.start, provider: "square" };
    },
    cancelBooking: async (id) => {
      const res = (await api(`/v2/bookings/${id}/cancel`, { method: "POST", body: "{}" })) as { booking?: { id: string } };
      if (!res.booking?.id) throw new Error("Square didn't confirm the cancellation.");
      return { cancelled: true, id };
    },
    getBookings: async (phone) => {
      let customerId: string;
      try {
        customerId = await findCustomer(api, phone, "Customer");
      } catch {
        return { bookings: [] };
      }
      const now = new Date();
      const res = (await api(
        `/v2/bookings?location_id=${encodeURIComponent(locationId)}&start_at_min=${encodeURIComponent(now.toISOString())}`,
      )) as { bookings?: { id: string; customer_id?: string; start_at?: string; status?: string; appointment_segments?: { service_variation_id?: string }[] }[] };
      const mine = (res.bookings ?? []).filter((b) => b.customer_id === customerId && b.status !== "CANCELLED_BY_CUSTOMER" && b.status !== "CANCELLED_BY_SELLER");
      const services = await listServices(api);
      const byVariation = new Map(services.map((s) => [s.variationId, s.name]));
      return {
        bookings: mine.map((b) => ({
          id: b.id,
          start: b.start_at,
          service: byVariation.get(b.appointment_segments?.[0]?.service_variation_id ?? "") ?? "Appointment",
          status: b.status,
        })),
      };
    },
    addWaitlist: (i) => native.addWaitlist(sb, salonId, i),
  };
}
