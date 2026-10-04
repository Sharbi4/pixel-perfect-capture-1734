import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./square-client.server", () => ({
  squareClientFor: async () => ({ api: mocks.api, locationId: "loc", businessName: "Salon" }),
}));
vi.mock("./booking.server", () => ({ addWaitlist: vi.fn() }));
import { squareAdapter } from "./square-adapter.server";
const segment = {
  duration_minutes: 30,
  service_variation_id: "variation",
  service_variation_version: 123,
  team_member_id: "staff",
};
const catalog = {
  objects: [
    {
      id: "item",
      item_data: {
        name: "Cut",
        product_type: "APPOINTMENTS_SERVICE",
        variations: [
          {
            id: "variation",
            version: 123,
            item_variation_data: {
              name: "Regular",
              available_for_booking: true,
              price_money: { amount: 2500, currency: "USD" },
              service_duration: 1800000,
            },
          },
        ],
      },
    },
  ],
};
beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockImplementation(async (path: string) => {
    if (path.startsWith("/v2/locations/")) return { location: { timezone: "America/Phoenix" } };
    if (path.startsWith("/v2/catalog")) return catalog;
    if (path === "/v2/bookings/availability/search")
      return {
        availabilities: [{ start_at: "2026-10-05T17:00:00Z", appointment_segments: [segment] }],
      };
    if (path === "/v2/customers/search") return { customers: [{ id: "customer" }] };
    if (path === "/v2/bookings")
      return { booking: { id: "booking", start_at: "2026-10-05T17:00:00Z" } };
    throw Error("Unexpected provider call: " + path);
  });
});
describe("Square booking handoff", () => {
  it("uses provider-confirmed staff and variation version when creating a booking", async () => {
    const adapter = await squareAdapter({} as never, "salon");
    const result = await adapter!.createBooking({
      service: "Cut",
      start: "2026-10-05T17:00:00Z",
      client_name: "Test",
      client_phone: "+15205550123",
      source: "ai_call",
    });
    expect(result).toMatchObject({ booked: true });
    const call = mocks.api.mock.calls.find(([path]) => path === "/v2/bookings")!;
    expect(JSON.parse(call[1].body).booking.appointment_segments).toEqual([segment]);
  });
  it("refuses a time missing from live availability before customer or booking writes", async () => {
    const adapter = await squareAdapter({} as never, "salon");
    expect(
      await adapter!.createBooking({
        service: "Cut",
        start: "2026-10-05T18:00:00Z",
        client_name: "Test",
        client_phone: "+15205550123",
        source: "ai_call",
      }),
    ).toMatchObject({ error: "unavailable" });
    expect(
      mocks.api.mock.calls.some(
        ([path]) => path === "/v2/bookings" || path === "/v2/customers/search",
      ),
    ).toBe(false);
  });
  it("searches the salon’s local day instead of the server timezone", async () => {
    const adapter = await squareAdapter({} as never, "salon");
    await adapter!.checkAvailability({ service: "Cut", date: "2026-10-05" });
    const call = mocks.api.mock.calls.find(
      ([path]) => path === "/v2/bookings/availability/search",
    )!;
    expect(JSON.parse(call[1].body).query.filter.start_at_range).toEqual({
      start_at: "2026-10-05T07:00:00.000Z",
      end_at: "2026-10-06T07:00:00.000Z",
    });
  });
});
