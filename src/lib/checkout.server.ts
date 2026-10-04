import { randomBytes, randomUUID } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import { adminClient } from "./jobs.server";
import {
  buyerSchema,
  previewSchema,
  nextMonth,
  localDate,
  type CheckoutStatus,
} from "./checkout-model";
import { runCheckout, type Purchase } from "./checkout-workflow";
import {
  squareConfig,
  validateSquarePlan,
  secretHash,
  seal,
  squareProvider,
  assertPurchaseEnvironment,
} from "./square-checkout.server";
import { getPlan, setup } from "./pricing";
import { z } from "zod";

const cookieName = "salon_checkout";
export function checkoutCookie(request: Request) {
  const value =
    request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) ?? "";
  return /^[a-f0-9]{64}$/.test(value) ? value : "";
}
export function responseJson(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
export function verifyCheckoutOrigin(request: Request) {
  const origin = request.headers.get("origin"),
    c = squareConfig();
  const dev =
    import.meta.env.DEV &&
    ["http://127.0.0.1:5185", "http://localhost:5185"].includes(origin ?? "");
  if (!origin || (!dev && origin !== c?.origin)) throw Error("origin_not_allowed");
}
export async function checkoutBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw Error("invalid_request");
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid_request");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    length += r.value.byteLength;
    if (length > 32000) {
      await reader.cancel();
      throw Error("request_too_large");
    }
    chunks.push(r.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function purchaseForRequest(request: Request): Promise<Purchase | null> {
  const token = checkoutCookie(request);
  if (!token) return null;
  const sb = await adminClient();
  const { data, error } = await sb
    .from("checkout_purchases")
    .select("*")
    .eq("secret_hash", secretHash(token))
    .maybeSingle();
  if (error) throw Error("checkout_storage_unavailable");
  return data as unknown as Purchase | null;
}
export function publicStatus(p: Purchase): CheckoutStatus {
  return {
    tier: getPlan(p.preview.tier).id,
    monthlyCents: p.monthly_cents,
    totalCents: p.total_cents,
    state: p.state,
    hasPayment: !!p.payment_id,
    email: p.email,
    nextBillingDate: p.next_billing_date,
    error:
      p.state === "refunded"
        ? "This purchase has a refund and needs support review. No new payment will be submitted here."
        : p.state === "needs_review"
          ? "We're confirming your payment and subscription. Do not pay again. Use Resume checkout or contact support if this continues."
          : "",
    canResume:
      p.state !== "paid" &&
      p.state !== "refunded" &&
      !!p.source_cipher &&
      Date.parse(p.created_at) > Date.now() - 3600000,
  };
}
export async function checkoutConfigResponse(request: Request) {
  const selected = getPlan(new URL(request.url).searchParams.get("plan"));
  try {
    const purchase = await purchaseForRequest(request);
    const plan = getPlan(purchase?.preview.tier ?? selected.id);
    const base = {
      tier: plan.id,
      monthlyCents: purchase?.monthly_cents ?? plan.monthlyCents,
      setupCents: purchase ? purchase.total_cents - purchase.monthly_cents : setup.cents,
      totalCents: purchase?.total_cents ?? plan.monthlyCents + setup.cents,
      purchase: purchase ? publicStatus(purchase) : null,
    };
    if (!squareConfig(plan.id)) return responseJson({ ...base, available: false });
    try {
      const c = await validateSquarePlan(plan.id);
      if (purchase) assertPurchaseEnvironment(purchase);
      return responseJson({
        ...base,
        available: true,
        applicationId: c.appId,
        locationId: c.locationId,
        environment: c.environment,
        nextBillingDate: purchase?.next_billing_date ?? nextMonth(localDate(c.timezone)),
      });
    } catch {
      return responseJson({ ...base, available: false });
    }
  } catch {
    return responseJson({ available: false, tier: selected.id });
  }
}
const startSchema = z.object({
  buyer: buyerSchema,
  preview: previewSchema,
  consent: z.literal(true),
  nextBillingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export async function startCheckout(request: Request, raw: unknown) {
  const data = startSchema.parse(raw),
    c = await validateSquarePlan(data.preview.tier);
  const plan = getPlan(data.preview.tier);
  const existing = await purchaseForRequest(request);
  if (existing) {
    if (
      existing.email !== data.buyer.email ||
      getPlan(existing.preview.tier).id !== data.preview.tier
    )
      throw Error("checkout_already_started");
    return responseJson({ purchase: publicStatus(existing) });
  }
  const next = nextMonth(localDate(c.timezone));
  if (data.nextBillingDate !== next) throw Error("quote_expired");
  const token = randomBytes(32).toString("hex"),
    sb = await adminClient();
  const { data: row, error } = await sb
    .from("checkout_purchases")
    .insert({
      id: randomUUID(),
      secret_hash: secretHash(token),
      email: data.buyer.email,
      buyer: data.buyer as unknown as Json,
      preview: data.preview as unknown as Json,
      environment: c.environment,
      location_id: c.locationId,
      plan_id: c.planId,
      plan_name: `Salon Pro Agent ${plan.name}`,
      timezone: c.timezone,
      next_billing_date: next,
      total_cents: plan.monthlyCents + setup.cents,
      monthly_cents: plan.monthlyCents,
      consent_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !row)
    throw Error(
      error?.code === "23505" ? "checkout_already_started" : "checkout_storage_unavailable",
    );
  return responseJson({ purchase: publicStatus(row as unknown as Purchase) }, 200, {
    "Set-Cookie": `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  });
}
export async function finishPurchase(p: Purchase, source?: string) {
  assertPurchaseEnvironment(p);
  if (p.state === "paid") {
    await sendCompletionInvite(p);
    return;
  }
  if (p.state === "refunded") return;
  await validateSquarePlan(getPlan(p.preview.tier).id);
  const sb = await adminClient();
  const { data: locked, error } = await sb.rpc("acquire_checkout", {
    p_id: p.id,
    p_secret: p.secret_hash,
    p_cipher: source ? seal(source) : "",
    p_hash: source ? secretHash(source) : "",
  });
  if (error) throw Error("checkout_review_required");
  if (!locked) return;
  const held = locked as unknown as Purchase;
  async function checkpoint(patch: Partial<Purchase>) {
    const { buyer: _buyer, preview: _preview, ...values } = patch;
    const { data, error } = await sb
      .from("checkout_purchases")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", p.id)
      .eq("lock_token", held.lock_token!)
      .select("id");
    if (error || !data?.length) throw Error("checkout_checkpoint_failed");
  }
  try {
    await runCheckout(held, squareProvider, checkpoint);
  } catch (e) {
    await checkpoint({
      state: "needs_review",
      error_code:
        e instanceof Error && /^\w+$/.test(e.message) ? e.message : "provider_unconfirmed",
    });
  } finally {
    await sb
      .from("checkout_purchases")
      .update({ lock_token: null, locked_at: null })
      .eq("id", p.id)
      .eq("lock_token", held.lock_token!);
  }
  const { data: fresh } = await sb.from("checkout_purchases").select("*").eq("id", p.id).single();
  if (fresh?.state === "paid") await sendCompletionInvite(fresh as unknown as Purchase);
}
/** Supabase sends the signed one-time invitation; we never construct or log auth links. */
export async function sendCompletionInvite(p: Purchase) {
  if (p.environment !== "production") return;
  const sb = await adminClient(),
    c = squareConfig();
  if (!c) return;
  const { data } = await sb
    .from("checkout_purchases")
    .update({ invite_state: "sending" })
    .eq("id", p.id)
    .eq("invite_state", "pending")
    .select("id");
  if (!data?.length) return;
  let failed = true;
  try {
    const { error } = await sb.auth.admin.inviteUserByEmail(p.email, {
      redirectTo: `${c.origin}/complete-account`,
    });
    failed = !!error;
  } catch {
    /* Payment is saved even if delivery is uncertain. */
  }
  // A failed/uncertain send is visible for recovery; never repeatedly email on provider retries.
  await sb
    .from("checkout_purchases")
    .update({ invite_state: failed ? "needs_attention" : "sent" })
    .eq("id", p.id);
}
export async function submitCheckout(request: Request, raw: unknown) {
  const data = z.object({ source: z.string().min(1).max(4096).optional() }).parse(raw),
    p = await purchaseForRequest(request);
  if (!p) throw Error("checkout_not_found");
  await finishPurchase(p, data.source);
  const fresh = await purchaseForRequest(request);
  return responseJson({ purchase: publicStatus(fresh!) });
}
export function checkoutError(e: unknown) {
  const code = e instanceof Error ? e.message : "checkout_unavailable";
  const messages: Record<string, string> = {
    checkout_already_started:
      "A checkout is already in progress. Resume it in the original browser, or sign in if you already purchased.",
    quote_expired: "The billing date changed. Reload before paying.",
    checkout_review_required:
      "This checkout needs a status review. Don't start another payment; contact support.",
    checkout_not_found:
      "Your checkout session could not be found. Return to your original browser to resume it.",
    origin_not_allowed: "Please open checkout from this website.",
  };
  return responseJson(
    {
      error:
        messages[code] ??
        "Checkout is unavailable right now. Please try again later. If you already submitted payment, don't pay again.",
    },
    code === "origin_not_allowed" ? 403 : 400,
  );
}
