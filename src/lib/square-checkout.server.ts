import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { CheckoutProvider, Purchase, Payment, Subscription } from "./checkout-workflow";
import { getPlan, setup, type Tier } from "./pricing";
export function squareConfig(tier?: Tier) {
  const env = process.env;
  const environment = env["SQUARE_ENVIRONMENT"];
  if (
    !["sandbox", "production"].includes(environment ?? "") ||
    env["SQUARE_CHECKOUT_ENABLED"] !== "true"
  )
    return null;
  const needed = [
    "SQUARE_ACCESS_TOKEN",
    "SQUARE_APPLICATION_ID",
    "SQUARE_LOCATION_ID",
    "CHECKOUT_ENCRYPTION_KEY",
    "SQUARE_BILLING_WEBHOOK_SIGNATURE_KEY",
    "PUBLIC_APP_ORIGIN",
  ];
  if (
    needed.some((k) => !env[k]) ||
    Buffer.from(env["CHECKOUT_ENCRYPTION_KEY"]!, "base64").length !== 32
  )
    return null;
  let origin: string;
  try {
    origin = new URL(env["PUBLIC_APP_ORIGIN"]!).origin;
  } catch {
    return null;
  }
  if (environment === "production" && !origin.startsWith("https://")) return null;
  const planId = tier
    ? env[`SQUARE_PLAN_VARIATION_ID_${tier.toUpperCase()}`] ||
      (tier === "pro" ? env["SQUARE_PLAN_VARIATION_ID"] : undefined)
    : "";
  if (tier && !planId) return null;
  return {
    environment: environment as "sandbox" | "production",
    origin,
    appId: env["SQUARE_APPLICATION_ID"]!,
    locationId: env["SQUARE_LOCATION_ID"]!,
    planId: planId ?? "",
  };
}
export function secretHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function seal(value: string) {
  const iv = randomBytes(12);
  const c = createCipheriv(
    "aes-256-gcm",
    Buffer.from(process.env["CHECKOUT_ENCRYPTION_KEY"]!, "base64"),
    iv,
  );
  const body = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}
export function unseal(value: string) {
  const all = Buffer.from(value, "base64");
  const d = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env["CHECKOUT_ENCRYPTION_KEY"]!, "base64"),
    all.subarray(0, 12),
  );
  d.setAuthTag(all.subarray(12, 28));
  return Buffer.concat([d.update(all.subarray(28)), d.final()]).toString("utf8");
}
export function verifySquareSignature(raw: string, signature: string, url: string, key: string) {
  if (!signature || !key) return false;
  const expected = Buffer.from(
    createHmac("sha256", key)
      .update(url + raw)
      .digest("base64"),
  );
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function squareRequest<T>(path: string, body?: unknown): Promise<T> {
  const c = squareConfig();
  if (!c) throw Error("checkout_unavailable");
  const base =
    c.environment === "sandbox"
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com";
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env["SQUARE_ACCESS_TOKEN"]}`,
      "Square-Version": "2026-09-16",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`square_${response.status}`); // Never return tokens, buyer details or raw provider responses.
  return (await response.json()) as T;
}
export async function validateSquarePlan(tier: Tier = "pro") {
  const plan = getPlan(tier);
  const c = squareConfig(tier);
  if (!c) throw Error("checkout_unavailable");
  const [catalog, loc] = await Promise.all([
    squareRequest<{
      object: {
        type: string;
        is_deleted?: boolean;
        subscription_plan_variation_data?: {
          monthly_billing_anchor_date?: number;
          can_prorate?: boolean;
          phases: Array<{
            cadence: string;
            periods?: number;
            pricing?: { type: string; price_money?: { amount: number; currency: string } };
          }>;
        };
      };
    }>(`/v2/catalog/object/${encodeURIComponent(c.planId)}`),
    squareRequest<{
      location: { status: string; currency: string; timezone: string; capabilities?: string[] };
    }>(`/v2/locations/${encodeURIComponent(c.locationId)}`),
  ]);
  const variation = catalog.object.subscription_plan_variation_data;
  if (variation?.monthly_billing_anchor_date || variation?.can_prorate)
    throw Error("plan_billing_date_mismatch");
  const phases = variation?.phases,
    phase = phases?.[0];
  if (
    catalog.object.type !== "SUBSCRIPTION_PLAN_VARIATION" ||
    catalog.object.is_deleted ||
    phases?.length !== 1 ||
    phase?.cadence !== "MONTHLY" ||
    phase.periods ||
    phase.pricing?.type !== "STATIC" ||
    phase.pricing.price_money?.amount !== plan.monthlyCents ||
    phase.pricing.price_money.currency !== "USD"
  )
    throw Error("plan_mismatch");
  if (
    loc.location.status !== "ACTIVE" ||
    loc.location.currency !== "USD" ||
    !loc.location.capabilities?.includes("CREDIT_CARD_PROCESSING")
  )
    throw Error("location_unavailable");
  return { ...c, timezone: loc.location.timezone };
}
export const squareProvider: CheckoutProvider = {
  async customer(key, b) {
    const r = await squareRequest<{ customer: { id: string } }>("/v2/customers", {
      idempotency_key: key,
      email_address: b.email,
      given_name: b.firstName,
      family_name: b.lastName,
      address: {
        address_line_1: b.address,
        locality: b.city,
        administrative_district_level_1: b.state,
        postal_code: b.zip,
        country: "US",
      },
    });
    return r.customer.id;
  },
  async charge(p) {
    const r = await squareRequest<{ payment: Payment }>("/v2/payments", {
      idempotency_key: `${p.id}:pay`,
      source_id: unseal(p.source_cipher),
      amount_money: { amount: p.total_cents, currency: "USD" },
      customer_id: p.customer_id,
      location_id: p.location_id,
      reference_id: p.id,
      buyer_email_address: p.email,
      autocomplete: true,
      note: `${p.plan_name}: one-time setup plus first month`,
    });
    return r.payment;
  },
  async payment(id) {
    return (await squareRequest<{ payment: Payment }>(`/v2/payments/${encodeURIComponent(id)}`))
      .payment;
  },
  async card(key, paymentId, customerId) {
    return (
      await squareRequest<{ card: { id: string } }>("/v2/cards", {
        idempotency_key: key,
        source_id: paymentId,
        card: { customer_id: customerId },
      })
    ).card.id;
  },
  async subscribe(p) {
    return (
      await squareRequest<{ subscription: Subscription }>("/v2/subscriptions", {
        idempotency_key: `${p.id}:sub`,
        location_id: p.location_id,
        plan_variation_id: p.plan_id,
        customer_id: p.customer_id,
        card_id: p.card_id,
        start_date: p.next_billing_date,
        monthly_billing_anchor_date: Number(p.next_billing_date.slice(-2)),
        timezone: p.timezone,
      })
    ).subscription;
  },
  async subscription(id) {
    return (
      await squareRequest<{ subscription: Subscription }>(
        `/v2/subscriptions/${encodeURIComponent(id)}`,
      )
    ).subscription;
  },
};
export function assertPurchaseEnvironment(p: Purchase) {
  const plan = getPlan(p.preview.tier);
  const c = squareConfig(plan.id);
  if (
    !c ||
    p.environment !== c.environment ||
    p.location_id !== c.locationId ||
    p.plan_id !== c.planId ||
    p.total_cents !== plan.monthlyCents + setup.cents ||
    p.monthly_cents !== plan.monthlyCents
  )
    throw Error("checkout_configuration_changed");
}
