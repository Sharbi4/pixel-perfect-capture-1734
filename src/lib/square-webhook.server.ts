import { z } from "zod";
import { adminClient } from "./jobs.server";
import {
  squareConfig,
  squareRequest,
  squareProvider,
  verifySquareSignature,
} from "./square-checkout.server";
import { finishPurchase, responseJson, sendCompletionInvite } from "./checkout.server";
import { renewalAccess, type Invoice } from "./billing-reconciliation";
import { validPayment, type Purchase, type Subscription } from "./checkout-workflow";

const eventSchema = z.object({
  event_id: z.string().min(1).max(255),
  type: z.string().max(100),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});
const objectSchema = z.object({
  id: z.string().optional(),
  payment_id: z.string().optional(),
  reference_id: z.string().optional(),
  customer_id: z.string().optional(),
  subscription_id: z.string().optional(),
  primary_recipient: z.object({ customer_id: z.string().optional() }).optional(),
});
export async function squareWebhook(request: Request) {
  const config = squareConfig();
  if (!config) return responseJson({ error: "unavailable" }, 503);
  // Limit memory before parsing; signature is over the exact incoming bytes.
  const reader = request.body?.getReader();
  if (!reader) return responseJson({ error: "body" }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > 256000) {
      await reader.cancel();
      return responseJson({ error: "size" }, 413);
    }
    chunks.push(r.value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (
    !verifySquareSignature(
      raw,
      request.headers.get("x-square-hmacsha256-signature") ?? "",
      `${config.origin}/api/public/square-billing-webhook`,
      process.env["SQUARE_BILLING_WEBHOOK_SIGNATURE_KEY"] ?? "",
    )
  )
    return responseJson({ error: "signature" }, 403);
  const e = eventSchema.safeParse(JSON.parse(raw));
  if (!e.success) return responseJson({ error: "event" }, 400);
  const kind = e.data.type.split(".")[0]!;
  if (!["payment", "invoice", "subscription", "refund"].includes(kind))
    return responseJson({ received: true });
  const object = objectSchema.safeParse(e.data.data.object[kind]);
  if (!object.success) return responseJson({ error: "object" }, 400);
  const o = object.data,
    sb = await adminClient();
  const { data: done, error: eventError } = await sb
    .from("billing_events")
    .select("processed_at")
    .eq("id", e.data.event_id)
    .maybeSingle();
  if (eventError) throw Error("event_storage");
  if (done?.processed_at) return responseJson({ received: true });
  async function lookup(
    column: "id" | "payment_id" | "subscription_id" | "customer_id",
    value: string | undefined,
  ) {
    if (!value) return null;
    const { data, error } = await sb
      .from("checkout_purchases")
      .select("*")
      .eq("environment", config!.environment)
      .eq(column, value)
      .maybeSingle();
    if (error) throw Error("purchase_lookup");
    return data as unknown as Purchase | null;
  }
  let p = await lookup("subscription_id", kind === "subscription" ? o.id : o.subscription_id);
  p ??= await lookup("payment_id", kind === "payment" ? o.id : o.payment_id);
  if (!p && o.reference_id && z.uuid().safeParse(o.reference_id).success)
    p = await lookup("id", o.reference_id);
  p ??= await lookup("customer_id", o.customer_id ?? o.primary_recipient?.customer_id);
  if (!p) return responseJson({ received: true }); // Another sale in the merchant's Square account.
  const { error: insertError } = await sb
    .from("billing_events")
    .upsert(
      { id: e.data.event_id, purchase_id: p.id, event_type: e.data.type },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (insertError) throw Error("event_storage");
  if (p.state !== "paid" && p.state !== "refunded") {
    await finishPurchase(p);
    const { data: fresh, error } = await sb
      .from("checkout_purchases")
      .select("*")
      .eq("id", p.id)
      .single();
    if (error) throw Error("purchase_lookup");
    p = fresh as unknown as Purchase;
    if (p.state !== "paid" && p.state !== "refunded") throw Error("purchase_pending");
  }
  if (p.state === "paid") {
    // Read current provider state, never trust an old event to grant or restore access.
    const payment = await squareProvider.payment(p.payment_id);
    let refunded = !!payment.refunded_money?.amount;
    if (!refunded && !validPayment(payment, p)) throw Error("payment_unconfirmed");
    let until: string | null = null;
    if (!refunded) {
      const sub = await squareProvider.subscription(p.subscription_id);
      // An older refunded invoice still requires review even after a newer paid invoice.
      if (kind === "invoice" && o.id) {
        const { invoice } = await squareRequest<{ invoice: Invoice }>(
          `/v2/invoices/${encodeURIComponent(o.id)}`,
        );
        if (
          invoice.subscription_id === p.subscription_id &&
          ["REFUNDED", "PARTIALLY_REFUNDED"].includes(invoice.status)
        )
          refunded = true;
      }
      if (sub.invoice_ids?.[0]) {
        const { invoice } = await squareRequest<{ invoice: Invoice }>(
          `/v2/invoices/${encodeURIComponent(sub.invoice_ids[0])}`,
        );
        if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(invoice.status)) refunded = true;
        else until = renewalAccess(p, sub as Subscription, invoice);
      }
    }
    if (refunded || until) {
      const { error } = await sb.rpc("apply_checkout_access", {
        p_id: p.id,
        p_until: until ?? new Date().toISOString(),
        p_refunded: refunded,
      });
      if (error) throw Error("access_update");
    }
    if (!refunded) await sendCompletionInvite(p);
  }
  const { error } = await sb
    .from("billing_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", e.data.event_id);
  if (error) throw Error("event_storage");
  return responseJson({ received: true });
}
