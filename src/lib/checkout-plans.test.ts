import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  squareConfig,
  validateSquarePlan,
  assertPurchaseEnvironment,
} from "./square-checkout.server";
import { previewSchema } from "./checkout-model";
import { getPlan, setup } from "./pricing";
import type { Purchase } from "./checkout-workflow";
function configure() {
  for (const [key, value] of Object.entries({
    SQUARE_CHECKOUT_ENABLED: "true",
    SQUARE_ENVIRONMENT: "sandbox",
    SQUARE_ACCESS_TOKEN: "fake-test-token",
    SQUARE_APPLICATION_ID: "fake-app",
    SQUARE_LOCATION_ID: "location",
    SQUARE_PLAN_VARIATION_ID_ESSENTIAL: "essential-plan",
    SQUARE_PLAN_VARIATION_ID_PRO: "pro-plan",
    SQUARE_PLAN_VARIATION_ID_PREMIER: "premier-plan",
    SQUARE_BILLING_WEBHOOK_SIGNATURE_KEY: "fake-signature",
    CHECKOUT_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    PUBLIC_APP_ORIGIN: "https://example.com",
  }))
    vi.stubEnv(key, value);
}
describe("tier-specific checkout validation", () => {
  beforeEach(configure);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it.each(["essential", "pro", "premier"] as const)(
    "validates %s against its own catalog price",
    async (tier) => {
      const p = getPlan(tier);
      const fetcher = vi.fn(async (url: string) =>
        Response.json(
          url.includes("/locations/")
            ? {
                location: {
                  status: "ACTIVE",
                  currency: "USD",
                  timezone: "America/Phoenix",
                  capabilities: ["CREDIT_CARD_PROCESSING"],
                },
              }
            : {
                object: {
                  type: "SUBSCRIPTION_PLAN_VARIATION",
                  subscription_plan_variation_data: {
                    phases: [
                      {
                        cadence: "MONTHLY",
                        pricing: {
                          type: "STATIC",
                          price_money: { amount: p.monthlyCents, currency: "USD" },
                        },
                      },
                    ],
                  },
                },
              },
        ),
      );
      vi.stubGlobal("fetch", fetcher);
      expect((await validateSquarePlan(tier)).planId).toBe(tier + "-plan");
      expect(fetcher.mock.calls.some(([url]) => url.endsWith(tier + "-plan"))).toBe(true);
    },
  );
  it("refuses a tier without its catalog variation", () => {
    vi.stubEnv("SQUARE_PLAN_VARIATION_ID_ESSENTIAL", "");
    vi.stubEnv("SQUARE_PLAN_VARIATION_ID", "legacy-pro");
    expect(squareConfig("essential")).toBeNull();
    expect(squareConfig("pro")?.planId).toBe("pro-plan");
  });
  it("rejects prices from a different tier and changed configurations", () => {
    const preview = previewSchema.parse({
      name: "Studio",
      businessType: "Hair Salon",
      website: "",
      services: "",
      voice: "mia",
      step: 2,
      tier: "essential",
    });
    const p = {
      preview,
      environment: "sandbox",
      location_id: "location",
      plan_id: "essential-plan",
      monthly_cents: 29900,
      total_cents: 29900 + setup.cents,
    } as Purchase;
    expect(() => assertPurchaseEnvironment(p)).not.toThrow();
    expect(() => assertPurchaseEnvironment({ ...p, monthly_cents: 44900 })).toThrow(
      "checkout_configuration_changed",
    );
    expect(() => assertPurchaseEnvironment({ ...p, plan_id: "pro-plan" })).toThrow(
      "checkout_configuration_changed",
    );
  });
  it("rejects unknown preview tier values", () => {
    expect(
      previewSchema.safeParse({
        name: "Studio",
        businessType: "Hair Salon",
        website: "",
        services: "",
        voice: "mia",
        step: 2,
        tier: "free",
      }).success,
    ).toBe(false);
  });
  it("rejects catalog prices that do not match the public plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json(
          url.includes("/locations/")
            ? {
                location: {
                  status: "ACTIVE",
                  currency: "USD",
                  timezone: "America/Phoenix",
                  capabilities: ["CREDIT_CARD_PROCESSING"],
                },
              }
            : {
                object: {
                  type: "SUBSCRIPTION_PLAN_VARIATION",
                  subscription_plan_variation_data: {
                    phases: [
                      {
                        cadence: "MONTHLY",
                        pricing: { type: "STATIC", price_money: { amount: 1, currency: "USD" } },
                      },
                    ],
                  },
                },
              },
        ),
      ),
    );
    await expect(validateSquarePlan("premier")).rejects.toThrow("plan_mismatch");
  });
});
