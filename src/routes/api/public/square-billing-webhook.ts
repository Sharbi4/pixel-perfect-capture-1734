import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/square-billing-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { squareWebhook } = await import("@/lib/square-webhook.server");
          return await squareWebhook(request);
        } catch {
          return Response.json({ error: "Please retry this event" }, { status: 503 });
        }
      },
    },
  },
});
