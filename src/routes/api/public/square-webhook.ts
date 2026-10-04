import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Square webhook receiver. Verifies x-square-hmacsha256-signature as
 * base64(HMAC_SHA256(signatureKey, notificationUrl + rawBody)) before any write.
 *
 * The signature is checked against every notification URL this app could have
 * been configured with in Square (the canonical PUBLIC_APP_ORIGIN URL and the
 * URL actually hit), because the public domain canonicalises www -> apex and
 * Square signs the exact URL it was given. A valid signature is still required
 * either way; without the secret key nothing verifies.
 */
export const Route = createFileRoute("/api/public/square-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signatureKey = process.env["SQUARE_WEBHOOK_SIGNATURE_KEY"];
        if (!signatureKey) return new Response("not configured", { status: 503 });

        const { squareWebhookUrl } = await import("@/lib/square.server");
        const candidates = new Set<string>();
        try {
          candidates.add(squareWebhookUrl());
        } catch {
          // PUBLIC_APP_ORIGIN not set yet — fall back to the URL that was hit.
        }
        try {
          const hit = new URL(request.url);
          candidates.add(`${hit.origin}${hit.pathname}`);
        } catch {
          // Unparseable request URL — nothing else to try.
        }
        if (candidates.size === 0) return new Response("not configured", { status: 503 });

        const body = await request.text();
        const provided = Buffer.from(request.headers.get("x-square-hmacsha256-signature") ?? "");
        let verified = false;
        for (const notificationUrl of candidates) {
          const expected = Buffer.from(
            createHmac("sha256", signatureKey).update(notificationUrl + body).digest("base64"),
          );
          if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
            verified = true;
            break;
          }
        }
        if (!verified) return new Response("invalid signature", { status: 401 });

        let event: {
          type?: string;
          data?: { object?: { payment?: { id?: string; order_id?: string; status?: string } } };
        };
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("bad request", { status: 400 });
        }

        if (event.type === "payment.updated" || event.type === "payment.created") {
          const payment = event.data?.object?.payment;
          if (payment?.order_id && payment.status) {
            const status =
              payment.status === "COMPLETED"
                ? "paid"
                : payment.status === "FAILED" || payment.status === "CANCELED"
                  ? "failed"
                  : "pending";
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin
              .from("payments")
              .update({ status, square_payment_id: payment.id ?? null, updated_at: new Date().toISOString() })
              .eq("square_order_id", payment.order_id);
            if (error) console.error("Payment update failed", error);
          }
        }
        return new Response("ok");
      },
    },
  },
});
