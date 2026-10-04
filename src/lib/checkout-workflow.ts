import type { Buyer, PreviewDraft } from "./checkout-model";
import { zonedMidnight } from "./checkout-model";
export type Purchase = {
  id: string;
  secret_hash: string;
  owner_id: string | null;
  email: string;
  buyer: Buyer;
  preview: PreviewDraft;
  state: "draft" | "processing" | "paid" | "needs_review" | "refunded";
  environment: "sandbox" | "production";
  location_id: string;
  plan_id: string;
  plan_name: string;
  timezone: string;
  next_billing_date: string;
  total_cents: number;
  monthly_cents: number;
  customer_id: string;
  payment_id: string;
  card_id: string;
  subscription_id: string;
  source_cipher: string;
  source_hash: string;
  lock_token: string | null;
  locked_at: string | null;
  error_code: string;
  paid_through: string | null;
  consent_at: string;
  created_at: string;
  invite_state: string;
  updated_at: string;
};
export type Payment = {
  id: string;
  status: string;
  amount_money?: { amount: number; currency: string };
  refunded_money?: { amount: number };
  customer_id?: string;
  location_id?: string;
  reference_id?: string;
};
export type Subscription = {
  id: string;
  status: string;
  customer_id: string;
  location_id: string;
  plan_variation_id: string;
  card_id: string;
  start_date: string;
  invoice_ids?: string[];
  charged_through_date?: string;
  version?: number;
};
export type CheckoutProvider = {
  customer: (key: string, buyer: Buyer) => Promise<string>;
  charge: (p: Purchase) => Promise<Payment>;
  payment: (id: string) => Promise<Payment>;
  card: (key: string, paymentId: string, customerId: string) => Promise<string>;
  subscribe: (p: Purchase) => Promise<Subscription>;
  subscription: (id: string) => Promise<Subscription>;
};
export function validPayment(p: Payment, order: Purchase) {
  return (
    p.status === "COMPLETED" &&
    p.amount_money?.currency === "USD" &&
    p.amount_money.amount === order.total_cents &&
    p.location_id === order.location_id &&
    p.customer_id === order.customer_id &&
    p.reference_id === order.id &&
    !p.refunded_money?.amount
  );
}
export function validSubscription(s: Subscription, p: Purchase) {
  return (
    ["ACTIVE", "PENDING"].includes(s.status) &&
    s.customer_id === p.customer_id &&
    s.location_id === p.location_id &&
    s.plan_variation_id === p.plan_id &&
    s.card_id === p.card_id &&
    s.start_date === p.next_billing_date
  );
}
/** Every external write uses an immutable purchase ID. A failed checkpoint stops this run. */
export async function runCheckout(
  initial: Purchase,
  provider: CheckoutProvider,
  checkpoint: (p: Partial<Purchase>) => Promise<void>,
) {
  let p = { ...initial };
  const save = async (patch: Partial<Purchase>) => {
    await checkpoint(patch);
    p = { ...p, ...patch };
  };
  if (p.state === "paid") return;
  if (p.state === "refunded") throw Error("checkout_closed");
  if (!p.customer_id) await save({ customer_id: await provider.customer(`${p.id}:cust`, p.buyer) });
  const payment = p.payment_id ? await provider.payment(p.payment_id) : await provider.charge(p);
  if (!validPayment(payment, p)) throw Error("payment_unconfirmed");
  if (!p.payment_id) await save({ payment_id: payment.id });
  if (!p.card_id)
    await save({ card_id: await provider.card(`${p.id}:card`, p.payment_id, p.customer_id) });
  const sub = p.subscription_id
    ? await provider.subscription(p.subscription_id)
    : await provider.subscribe(p);
  if (!validSubscription(sub, p)) throw Error("subscription_unconfirmed");
  // Initial access ends at the next billing date. Renewal requires a verified paid invoice.
  await save({
    subscription_id: sub.id,
    state: "paid",
    paid_through: zonedMidnight(p.next_billing_date, p.timezone),
    source_cipher: "",
    source_hash: "",
    error_code: "",
  });
}
