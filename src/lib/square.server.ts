// Server-only Square helpers. Never import from client-reachable modules.
import { createHmac, timingSafeEqual } from "crypto";

export const SETUP_FEE_CENTS = 150_000; // $1,500 one-time setup
export const MONTHLY_CENTS = 44_900; // $449/month (recurring plan — see notes)

function squareConfig() {
  const token = process.env["SQUARE_ACCESS_TOKEN"];
  const locationId = process.env["SQUARE_LOCATION_ID"];
  const origin = process.env["PUBLIC_APP_ORIGIN"];
  if (!token || !locationId) throw new Error("Payments are not configured yet.");
  if (!origin) throw new Error("Payments are not configured yet.");
  return { token, locationId, origin: origin.replace(/\/$/, "") };
}

export function squareWebhookUrl(): string {
  const origin = process.env["PUBLIC_APP_ORIGIN"];
  if (!origin) throw new Error("Payments are not configured yet.");
  return `${origin.replace(/\/$/, "")}/api/public/square-webhook`;
}

async function squareFetch(path: string, init: RequestInit): Promise<unknown> {
  const { token } = squareConfig();
  const res = await fetch(`https://connect.squareup.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2025-10-16",
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as { errors?: { detail?: string }[] } | null;
  if (!res.ok) {
    // Log provider detail server-side only; never leak to customers.
    console.error("Square API error", res.status, body?.errors);
    throw new Error("Payment provider request failed. Please try again.");
  }
  return body;
}

export type PaymentLink = { id: string; url: string; orderId: string };

/** Create a Square hosted checkout link for the one-time setup fee. */
export async function createSetupPaymentLink(args: {
  idempotencyKey: string;
  salonId: string;
  salonName: string;
}): Promise<PaymentLink> {
  const { locationId, origin } = squareConfig();
  const body = (await squareFetch("/v2/online-checkout/payment-links", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: args.idempotencyKey,
      quick_pay: {
        name: (args.salonName.trim() ? `Salon Pro Agent setup — ${args.salonName}` : "Salon Pro Agent setup").slice(0, 255),
        price_money: { amount: SETUP_FEE_CENTS, currency: "USD" },
        location_id: locationId,
      },
      checkout_options: {
        redirect_url: `${origin}/setup?paid=1`,
        ask_for_shipping_address: false,
      },
      payment_note: `salon:${args.salonId}`.slice(0, 500),
    }),
  })) as {
    payment_link?: { id?: string; url?: string; order_id?: string };
  };
  const link = body.payment_link;
  if (!link?.id || !link.url || !link.order_id) {
    console.error("Square payment link response missing fields", body);
    throw new Error("Payment provider returned an unexpected response.");
  }
  return { id: link.id, url: link.url, orderId: link.order_id };
}
