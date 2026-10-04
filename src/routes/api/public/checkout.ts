import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/checkout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const c = await import("@/lib/checkout.server");
        return c.checkoutConfigResponse(request);
      },
      POST: async ({ request }) => {
        const c = await import("@/lib/checkout.server");
        try {
          c.verifyCheckoutOrigin(request);
          const data = await c.checkoutBody(request);
          return data.action === "start"
            ? await c.startCheckout(request, data)
            : data.action === "submit"
              ? await c.submitCheckout(request, data)
              : c.responseJson({ error: "Unknown action" }, 400);
        } catch (e) {
          return c.checkoutError(e);
        }
      },
    },
  },
});
