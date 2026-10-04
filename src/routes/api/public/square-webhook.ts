import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Square webhook receiver. Verifies x-square-hmacsha256-signature as
 * base64(HMAC_SHA256(signatureKey, notificationUrl + rawBody)) before any write.
 */
export const Route = createFileRoute("/api/public/square-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signatureKey = process.env["SQUARE_WEBHOOK_SIGNATURE_KEY"];
        if (!signatureKey) return new Response("not configured", { status: 503 });

        const { squareWebhookUrl } = await import("@/lib/square.server");
        let notificationUrl: string;
        try {
          notificationUrl = squareWebhookUrl();
        } catch {
          return new Response("not configured", { status: 503 });
        }

        const body = await request.text();
        const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
        const expected = createHmac("sha256", signatureKey)
          .update(notificationUrl + body)
          .digest("base64");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }

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
