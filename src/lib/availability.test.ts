import { describe, expect, it } from "vitest";
import { openSlots, zoned, localDate, type StaffLite } from "./availability";

const rules = { timezone: "America/Phoenix", buffer_min: 10, lead_min: 60, horizon_days: 60 };
const mia: StaffLite = { id: "mia", name: "Mia", service_ids: [], hours: { "1": [[540, 660]] }, active: true }; // Mon 9-11
const now = new Date("2026-10-01T12:00:00Z");
const date = "2026-10-05"; // Monday

describe("availability", () => {
  it("converts salon wall time to UTC", () => {
    expect(zoned(date, 540, "America/Phoenix").toISOString()).toBe("2026-10-05T16:00:00.000Z");
    expect(zoned("2026-01-05", 540, "America/New_York").toISOString()).toBe("2026-01-05T14:00:00.000Z");
    expect(localDate(new Date("2026-10-06T05:00:00Z"), "America/Phoenix")).toBe("2026-10-05");
  });
  it("fits the service inside working hours", () => {
    const s = openSlots({ date, staff: [mia], busy: [], minutes: 60, rules, now });
    expect(s.map((x) => x.start)).toEqual(["2026-10-05T16:00:00.000Z", "2026-10-05T16:15:00.000Z", "2026-10-05T16:30:00.000Z", "2026-10-05T16:45:00.000Z", "2026-10-05T17:00:00.000Z"]);
  });
  it("respects existing bookings plus buffer", () => {
    const busy = [{ staff_id: "mia", starts_at: "2026-10-05T16:30:00Z", ends_at: "2026-10-05T17:00:00Z" }];
    const s = openSlots({ date, staff: [mia], busy, minutes: 30, rules, now }).map((x) => x.start);
    expect(s).not.toContain("2026-10-05T16:00:00.000Z"); // ends 9:30, buffer touches 9:30 booking
    expect(s).toContain("2026-10-05T17:15:00.000Z");
    expect(s).not.toContain("2026-10-05T17:00:00.000Z");
  });
  it("blocks days off, lead time and other services", () => {
    expect(openSlots({ date: "2026-10-04", staff: [mia], busy: [], minutes: 30, rules, now })).toEqual([]);
    expect(openSlots({ date, staff: [mia], busy: [], minutes: 30, rules, now: new Date("2026-10-05T17:30:00Z") })).toEqual([]);
    expect(openSlots({ date, staff: [{ ...mia, service_ids: ["gel"] }], busy: [], minutes: 30, rules, now, serviceId: "pedi" })).toEqual([]);
  });
});
