import { taxCents } from "./sales-tax";
import { nextDay, zonedMidnight } from "./checkout-model";
import type { Purchase, Subscription } from "./checkout-workflow";
export type Invoice = {
  id: string;
  status: string;
  subscription_id?: string;
  location_id?: string;
  primary_recipient?: { customer_id?: string };
  payment_requests?: Array<{
    computed_amount_money?: { amount: number; currency: string };
    total_completed_amount_money?: { amount: number; currency: string };
  }>;
};
/** charged_through_date alone only means invoiced. The latest invoice must be paid. */
export function renewalAccess(p: Purchase, s: Subscription, i: Invoice): string | null {
  if (
    s.id !== p.subscription_id ||
    s.customer_id !== p.customer_id ||
    s.location_id !== p.location_id ||
    s.plan_variation_id !== p.plan_id ||
    !s.charged_through_date ||
    s.invoice_ids?.[0] !== i.id
  )
    return null;
  if (
    i.status !== "PAID" ||
    i.subscription_id !== s.id ||
    i.location_id !== p.location_id ||
    i.primary_recipient?.customer_id !== p.customer_id ||
    !i.payment_requests?.length
  )
    return null;
  let total = 0;
  for (const r of i.payment_requests) {
    const due = r.computed_amount_money,
      paid = r.total_completed_amount_money;
    if (
      !due ||
      !paid ||
      due.currency !== "USD" ||
      paid.currency !== "USD" ||
      paid.amount < due.amount
    )
      return null;
    total += due.amount;
  }
  const expected = p.monthly_cents + taxCents(p.monthly_cents, p.buyer?.state);
  if (Math.abs(total - expected) > 1) return null;
  return zonedMidnight(nextDay(s.charged_through_date), p.timezone);
}
