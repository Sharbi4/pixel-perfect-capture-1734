import { createFileRoute } from "@tanstack/react-router";

/**
 * Square webhook receiver. Verifies x-square-hmacsha256-signature before any
 * write. See verifySquareSignature for why several notification URLs are tried.
 */
export const Route = createFileRoute("/api/public/square-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signatureKey = process.env["SQUARE_WEBHOOK_SIGNATURE_KEY"];
        if (!signatureKey) return new Response("not configured", { status: 503 });

        const { squareWebhookUrl, verifySquareSignature } = await import("@/lib/square.server");
        const candidates: string[] = [];
        try {
          candidates.push(squareWebhookUrl());
        } catch {
          // PUBLIC_APP_ORIGIN not set yet — fall back to the URL that was hit.
        }
        try {
          const hit = new URL(request.url);
          candidates.push(`${hit.origin}${hit.pathname}`);
        } catch {
          // Unparseable request URL — nothing else to try.
        }
        if (candidates.length === 0) return new Response("not configured", { status: 503 });

        const body = await request.text();
        const verified = verifySquareSignature({
          signatureKey,
          notificationUrls: candidates,
          signature: request.headers.get("x-square-hmacsha256-signature") ?? "",
          body,
        });
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
