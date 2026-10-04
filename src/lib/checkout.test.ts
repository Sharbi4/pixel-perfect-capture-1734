import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { nextMonth, zonedMidnight } from "./checkout-model";
import {
  runCheckout,
  type Purchase,
  type CheckoutProvider,
  type Payment,
  type Subscription,
} from "./checkout-workflow";
import { renewalAccess, type Invoice } from "./billing-reconciliation";
import { verifySquareSignature, squareConfig } from "./square-checkout.server";

const purchase = (): Purchase => ({
  id: "11111111-1111-4111-8111-111111111111",
  secret_hash: "secret",
  owner_id: null,
  email: "test@example.com",
  buyer: {
    email: "test@example.com",
    firstName: "Test",
    lastName: "Owner",
    address: "1 Test St",
    city: "Phoenix",
    state: "AZ",
    zip: "85001",
  },
  preview: {
    tier: "pro",
    phoneIntent: "forward", calendarIntent: "unsure", addonInterests: [],
    name: "Test Studio",
    businessType: "Hair Salon",
    website: "",
    services: "Haircut",
    voice: "mia",
    step: 2,
  },
  state: "processing",
  environment: "sandbox",
  location_id: "loc",
  plan_id: "plan",
  plan_name: "Test",
  timezone: "America/Phoenix",
  next_billing_date: "2026-11-02",
  total_cents: 194400,
  monthly_cents: 44900,
  customer_id: "",
  payment_id: "",
  card_id: "",
  subscription_id: "",
  source_cipher: "encrypted",
  source_hash: "hash",
  lock_token: "lock",
  locked_at: null,
  error_code: "",
  paid_through: null,
  consent_at: "2026-10-02T00:00:00Z",
  created_at: "2026-10-02T00:00:00Z",
  invite_state: "pending",
  updated_at: "2026-10-02T00:00:00Z",
});
const payment = (p: Purchase): Payment => ({
  id: "pay",
  status: "COMPLETED",
  amount_money: { amount: p.total_cents, currency: "USD" },
  customer_id: "cust",
  location_id: p.location_id,
  reference_id: p.id,
});
const sub = (p: Purchase): Subscription => ({
  id: "sub",
  status: "PENDING",
  customer_id: "cust",
  location_id: p.location_id,
  plan_variation_id: p.plan_id,
  card_id: "card",
  start_date: p.next_billing_date,
});
function provider(p: Purchase): CheckoutProvider {
  return {
    customer: vi.fn(async () => "cust"),
    charge: vi.fn(async () => payment(p)),
    payment: vi.fn(async () => payment(p)),
    card: vi.fn(async () => "card"),
    subscribe: vi.fn(async () => sub(p)),
    subscription: vi.fn(async () => sub(p)),
  };
}
describe("checkout durability", () => {
  it("charges once, starts the subscription next month, and erases the token", async () => {
    const p = purchase(),
      api = provider(p);
    await runCheckout(p, api, async (patch) => {
      Object.assign(p, patch);
    });
    expect(p.state).toBe("paid");
    expect(p.paid_through).toBe("2026-11-02T07:00:00.000Z");
    expect(p.source_cipher).toBe("");
    expect(api.charge).toHaveBeenCalledTimes(1);
    expect(api.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        next_billing_date: "2026-11-02",
        payment_id: "pay",
        card_id: "card",
      }),
    );
  });
  it("does not charge again after a persisted payment and a lost card response", async () => {
    const p = purchase(),
      api = provider(p);
    vi.mocked(api.card).mockRejectedValueOnce(Error("lost_response"));
    const save = async (patch: Partial<Purchase>) => {
      Object.assign(p, patch);
    };
    await expect(runCheckout(p, api, save)).rejects.toThrow("lost_response");
    await runCheckout(p, api, save);
    expect(api.charge).toHaveBeenCalledTimes(1);
    expect(api.payment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.card).mock.calls[0]).toEqual(vi.mocked(api.card).mock.calls[1]);
  });
  it("stops before another mutation when persistence fails", async () => {
    const p = purchase(),
      api = provider(p);
    await expect(
      runCheckout(p, api, async (patch) => {
        if (patch.payment_id) throw Error("db_down");
        Object.assign(p, patch);
      }),
    ).rejects.toThrow("db_down");
    expect(api.card).not.toHaveBeenCalled();
    expect(api.subscribe).not.toHaveBeenCalled();
  });
  it.each(["amount", "currency", "customer", "location", "reference", "refund", "pending"])(
    "rejects unverified payment: %s",
    async (kind) => {
      const p = purchase(),
        api = provider(p),
        r = payment(p);
      if (kind === "amount") r.amount_money!.amount = 1;
      if (kind === "currency") r.amount_money!.currency = "CAD";
      if (kind === "customer") r.customer_id = "other";
      if (kind === "location") r.location_id = "other";
      if (kind === "reference") r.reference_id = "other";
      if (kind === "refund") r.refunded_money = { amount: 100 };
      if (kind === "pending") r.status = "PENDING";
      vi.mocked(api.charge).mockResolvedValue(r);
      await expect(
        runCheckout(p, api, async (patch) => {
          Object.assign(p, patch);
        }),
      ).rejects.toThrow("payment_unconfirmed");
      expect(api.card).not.toHaveBeenCalled();
      expect(p.state).not.toBe("paid");
    },
  );
  it("does not grant access for the wrong subscription", async () => {
    const p = purchase(),
      api = provider(p);
    vi.mocked(api.subscribe).mockResolvedValue({ ...sub(p), plan_variation_id: "other" });
    await expect(
      runCheckout(p, api, async (patch) => {
        Object.assign(p, patch);
      }),
    ).rejects.toThrow("subscription_unconfirmed");
    expect(p.paid_through).toBeNull();
  });
  it("never reopens a refunded purchase", async () => {
    const p = { ...purchase(), state: "refunded" as const },
      api = provider(p);
    await expect(runCheckout(p, api, vi.fn())).rejects.toThrow("checkout_closed");
    expect(api.charge).not.toHaveBeenCalled();
  });
});
describe("billing dates and renewals", () => {
  it("clamps month ends and handles leap years", () => {
    expect(nextMonth("2026-01-31")).toBe("2026-02-28");
    expect(nextMonth("2028-01-31")).toBe("2028-02-29");
    expect(nextMonth("2026-12-31")).toBe("2027-01-31");
  });
  it("uses the location's offset at the actual billing boundary", () => {
    expect(zonedMidnight("2026-03-09", "America/New_York")).toBe("2026-03-09T04:00:00.000Z");
    expect(zonedMidnight("2026-11-02", "America/New_York")).toBe("2026-11-02T05:00:00.000Z");
  });
  const paid = () => {
    const p = { ...purchase(), customer_id: "cust", subscription_id: "sub" };
    const s = { ...sub(p), charged_through_date: "2026-12-01", invoice_ids: ["invoice"] };
    const i: Invoice = {
      id: "invoice",
      status: "PAID",
      subscription_id: "sub",
      location_id: "loc",
      primary_recipient: { customer_id: "cust" },
      payment_requests: [
        {
          computed_amount_money: { amount: 48725, currency: "USD" },
          total_completed_amount_money: { amount: 48725, currency: "USD" },
        },
      ],
    };
    return { p, s, i };
  };
  it("extends through a verified paid invoice period", () => {
    const { p, s, i } = paid();
    expect(renewalAccess(p, s, i)).toBe("2026-12-02T07:00:00.000Z");
  });
  it.each(["unpaid", "old_invoice", "customer", "underpaid"])("does not grant for %s", (kind) => {
    const { p, s, i } = paid();
    if (kind === "unpaid") i.status = "UNPAID";
    if (kind === "old_invoice") i.id = "old";
    if (kind === "customer") i.primary_recipient!.customer_id = "other";
    if (kind === "underpaid") i.payment_requests![0]!.total_completed_amount_money!.amount = 100;
    expect(renewalAccess(p, s, i)).toBeNull();
  });
});
describe("Square configuration and signature", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("authenticates the raw body and canonical URL", () => {
    const raw = '{"event_id":"event"}',
      url = "https://example.com/api/public/square-billing-webhook",
      key = "test-key";
    const signature = createHmac("sha256", key)
      .update(url + raw)
      .digest("base64");
    expect(verifySquareSignature(raw, signature, url, key)).toBe(true);
    expect(verifySquareSignature(raw + " ", signature, url, key)).toBe(false);
    expect(verifySquareSignature(raw, signature, url + "/", key)).toBe(false);
    expect(verifySquareSignature(raw, "", url, key)).toBe(false);
  });
  it("stays disabled without an explicit enable flag", () => {
    vi.stubEnv("SQUARE_CHECKOUT_ENABLED", "false");
    expect(squareConfig()).toBeNull();
  });
});
