// Booking adapter for salons whose booking_provider is 'square'. Every call uses the salon's
// own encrypted Square token (refreshed server-side) and its chosen location. If anything about
// the connection fails, the adapter returns null so the agent says it can't see the calendar
// rather than inventing availability.
import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { BookInput, BookingAdapter } from "./booking-adapters.server";
import * as native from "./booking.server";
import { squareClientFor, type SquareApi } from "./square-client.server";

type Admin = typeof supabaseAdmin;

import { readSquareCatalog } from "./square-catalog";
import { localDate, nextDay, zonedMidnight } from "./checkout-model";
const listServices = readSquareCatalog;
type Segment = {
  duration_minutes: number;
  service_variation_id: string;
  service_variation_version: number;
  team_member_id: string;
};
type Availability = { start_at: string; appointment_segments: Segment[] };
async function available(
  api: SquareApi,
  locationId: string,
  variationId: string,
  start: string,
  end: string,
  staff?: string,
): Promise<Availability[]> {
  let teamId: string | undefined;
  if (staff) {
    const response = (await api(
      "/v2/bookings/team-member-booking-profiles?bookable_only=true",
    )) as { team_member_booking_profiles?: { team_member_id: string; display_name: string }[] };
    const matches = (response.team_member_booking_profiles ?? []).filter(
      (t) => t.display_name.toLowerCase() === staff.toLowerCase(),
    );
    if (matches.length !== 1) return [];
    teamId = matches[0]!.team_member_id;
  }
  const response = (await api("/v2/bookings/availability/search", {
    method: "POST",
    body: JSON.stringify({
      query: {
        filter: {
          location_id: locationId,
          start_at_range: { start_at: start, end_at: end },
          segment_filters: [
            {
              service_variation_id: variationId,
              ...(teamId ? { team_member_id_filter: { any: [teamId] } } : {}),
            },
          ],
        },
      },
    }),
  })) as { availabilities?: Availability[] };
  return response.availabilities ?? [];
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
    body: JSON.stringify({
      given_name: givenName || name,
      family_name: rest.join(" ") || undefined,
      phone_number: phone,
    }),
  })) as { customer?: { id: string } };
  if (!created.customer?.id) throw new Error("Couldn't create the Square customer.");
  return created.customer.id;
}

export async function squareAdapter(sb: Admin, salonId: string): Promise<BookingAdapter | null> {
  const client = await squareClientFor(salonId);
  if (!client) return null;
  const { api, locationId } = client;
  const location = (await api(`/v2/locations/${encodeURIComponent(locationId)}`)) as {
    location?: { timezone?: string };
  };
  const timezone = location.location?.timezone;
  if (!timezone) return null;

  return {
    getServices: async () => {
      const services = await listServices(api);
      return {
        services: services.map((s) => ({ name: s.name, price: s.price, minutes: s.minutes })),
      };
    },
    getStaff: async () => {
      const response = (await api(
        "/v2/bookings/team-member-booking-profiles?bookable_only=true",
      )) as { team_member_booking_profiles?: { display_name: string }[] };
      return {
        technicians: (response.team_member_booking_profiles ?? []).map((t) => ({
          name: t.display_name,
          services: "Confirm eligibility with an availability search",
        })),
      };
    },
    checkAvailability: async (q) => {
      const services = await listServices(api);
      const matches = services.filter(
        (s) => s.name.toLowerCase() === q.service?.trim().toLowerCase(),
      );
      if (matches.length !== 1)
        return {
          error: "choose_service",
          say: "Ask which exact service the client wants before checking availability.",
        };
      const match = matches[0]!;
      const date = q.date || localDate(timezone);
      const slots = await available(
        api,
        locationId,
        match.variationId,
        zonedMidnight(date, timezone),
        zonedMidnight(nextDay(date), timezone),
        q.staff,
      );
      return {
        date,
        timezone,
        service: match.name,
        slots: slots.map((a) => a.start_at).slice(0, 12),
      };
    },
    createBooking: async (i: BookInput) => {
      const services = await listServices(api);
      const match = services.find((s) => s.name.toLowerCase() === i.service.trim().toLowerCase());
      if (!match)
        return {
          error: "service_not_found",
          say: `I couldn't find "${i.service}" on the salon's Square menu. Offer to take a message.`,
        };
      if (!/(Z|[+-]\d{2}:\d{2})$/.test(i.start) || !Number.isFinite(Date.parse(i.start)))
        return { error: "invalid_time", say: "Confirm the appointment time and timezone." };
      const slots = await available(
        api,
        locationId,
        match.variationId,
        new Date(i.start).toISOString(),
        new Date(Date.parse(i.start) + 86400000).toISOString(),
        i.technician,
      );
      const slot = slots.find((a) => Date.parse(a.start_at) === Date.parse(i.start));
      if (
        !slot?.appointment_segments?.length ||
        slot.appointment_segments.some(
          (s) => !s.team_member_id || !Number.isSafeInteger(s.service_variation_version),
        )
      )
        return {
          error: "unavailable",
          say: "That appointment could not be confirmed. Offer another available time.",
        };
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
            appointment_segments: slot.appointment_segments,
          },
        }),
      })) as { booking?: { id: string; start_at?: string } };
      if (!res.booking?.id) throw new Error("Square didn't confirm the booking.");
      return {
        booked: true,
        id: res.booking.id,
        service: match.name,
        start: res.booking.start_at ?? i.start,
        provider: "square",
      };
    },
    rescheduleBooking: async (id, i) => {
      const res = (await api(`/v2/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify({ booking: { start_at: i.start } }),
      })) as { booking?: { id: string; start_at?: string } };
      if (!res.booking?.id) throw new Error("Square didn't confirm the reschedule.");
      return {
        booked: true,
        id: res.booking.id,
        start: res.booking.start_at ?? i.start,
        provider: "square",
      };
    },
    cancelBooking: async (id) => {
      const res = (await api(`/v2/bookings/${id}/cancel`, { method: "POST", body: "{}" })) as {
        booking?: { id: string };
      };
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
      )) as {
        bookings?: {
          id: string;
          customer_id?: string;
          start_at?: string;
          status?: string;
          appointment_segments?: { service_variation_id?: string }[];
        }[];
      };
      const mine = (res.bookings ?? []).filter(
        (b) =>
          b.customer_id === customerId &&
          b.status !== "CANCELLED_BY_CUSTOMER" &&
          b.status !== "CANCELLED_BY_SELLER",
      );
      const services = await listServices(api);
      const byVariation = new Map(services.map((s) => [s.variationId, s.name]));
      return {
        bookings: mine.map((b) => ({
          id: b.id,
          start: b.start_at,
          service:
            byVariation.get(b.appointment_segments?.[0]?.service_variation_id ?? "") ??
            "Appointment",
          status: b.status,
        })),
      };
    },
    addWaitlist: (i) => native.addWaitlist(sb, salonId, i),
  };
}
