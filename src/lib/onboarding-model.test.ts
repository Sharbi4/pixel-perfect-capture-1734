import { describe, it, expect, vi } from "vitest";
import { readOnboarding, onboardingSchema, mergeServiceProposal } from "./onboarding-model";
import { catalogServices, readSquareCatalog, type CatalogItem } from "./square-catalog";
import { previewSchema } from "./checkout-model";
describe("onboarding resume and import", () => {
  it("restores paid step and phone choice with safe legacy defaults", () => {
    expect(readOnboarding(null).step).toBe(0);
    expect(
      readOnboarding({ onboarding: { step: 2, phoneIntent: "new", areaCode: "520" } }),
    ).toMatchObject({ step: 2, phoneIntent: "new", areaCode: "520" });
    expect(onboardingSchema.safeParse({ step: 99 }).success).toBe(false);
  });
  it("keeps stable IDs, unrelated services and original inputs when approving imported rows", () => {
    const original = [
      { id: "a", name: "Cut", price: 20, minutes: 30, is_addon: false },
      { id: "b", name: "Color", price: 80, minutes: 90, is_addon: false },
    ];
    const merged = mergeServiceProposal(original, [
      { name: "cut", price: 25, minutes: 45, is_addon: false },
      { name: "Style", price: 10, minutes: 15, is_addon: true },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged[0]).toMatchObject({ id: "a", price: 25 });
    expect(merged[1]).toEqual(original[1]);
    expect(original[0]!.price).toBe(20);
  });
  it("accepts older preview drafts without phone/calendar questions", () => {
    expect(
      previewSchema.parse({
        name: "Salon",
        businessType: "Hair",
        website: "",
        services: "",
        voice: "mia",
        step: 0,
      }).phoneIntent,
    ).toBe("forward");
  });
});
const item: CatalogItem = {
  id: "item",
  item_data: {
    name: "Cut",
    product_type: "APPOINTMENTS_SERVICE",
    variations: [
      {
        id: "v1",
        version: 1,
        item_variation_data: {
          name: "Regular",
          available_for_booking: true,
          price_money: { amount: 2500, currency: "USD" },
          service_duration: 1800000,
        },
      },
    ],
  },
};
describe("Square catalog", () => {
  it("uses provider price and duration and excludes retail, incomplete and unbookable items", () => {
    const retail = structuredClone(item);
    retail.item_data!.product_type = "REGULAR";
    const incomplete = structuredClone(item);
    delete incomplete.item_data!.variations![0]!.item_variation_data!.service_duration;
    expect(catalogServices([item, retail, incomplete])).toEqual([
      { name: "Cut", variationId: "v1", version: 1, price: 25, minutes: 30, description: "" },
    ]);
  });
  it("reads every page and encodes cursors", async () => {
    const api = vi
      .fn()
      .mockResolvedValueOnce({ objects: [], cursor: "next/page" })
      .mockResolvedValueOnce({ objects: [item] });
    expect(await readSquareCatalog(api)).toHaveLength(1);
    expect(api.mock.calls[1]![0]).toContain("next%2Fpage");
  });
  it("rejects repeated cursors instead of importing an incomplete menu", async () => {
    await expect(readSquareCatalog(async () => ({ cursor: "same" }))).rejects.toThrow("repeated");
  });
});
