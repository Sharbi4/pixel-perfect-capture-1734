import { describe, expect, it } from "vitest";
import { renderSms } from "./sms-templates";

describe("renderSms", () => {
  it("keeps the required opt-out line even if the owner removed it", () => {
    expect(renderSms("marketing", "Big sale {offer}", { salon: "Bella", offer: "today" })).toBe("Bella: Big sale today Msg & data rates may apply. Reply STOP to opt out.");
  });
  it("uses the default wording and fills placeholders", () => {
    expect(renderSms("cancellation_confirmation", "", { salon: "Bella", service: "Gel", when: "Fri" })).toBe("Bella: your Gel on Fri is cancelled. Reply to book a new time.");
  });
  it("adds the salon name when edited wording leaves it out", () => {
    expect(renderSms("address", "Find us at {address}", { salon: "Bella", address: "1 Main" })).toBe("Bella: Find us at 1 Main");
  });
});
