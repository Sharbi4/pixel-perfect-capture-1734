// Square OAuth redirect target (the Production Redirect URL in the Square app). Public by
// necessity — Square sends the browser here — so trust comes from the HMAC-signed state param,
// and the salon_members role in the state is re-verified before anything is stored.
import { createFileRoute } from "@tanstack/react-router";
import { exchangeSquareCode, fetchMerchantProfile, saveSquareConnection, verifySquareState } from "@/lib/square-client.server";

function redirect(origin: string, result: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${origin}/dashboard/agent?square=${result}` } });
}

export const Route = createFileRoute("/api/public/square-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = (process.env["PUBLIC_APP_ORIGIN"] ?? url.origin).replace(/\/$/, "");
        if (url.searchParams.get("error")) return redirect(origin, "denied");
        const code = url.searchParams.get("code") ?? "";
        const state = url.searchParams.get("state") ?? "";
        const payload = verifySquareState(state);
        if (!code || !payload) return redirect(origin, "invalid");
        try {
          // The state proves the flow started from an owner/manager's session; re-check they
          // still hold that role before saving tokens for this salon.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: member } = await supabaseAdmin
            .from("salon_members")
            .select("role")
            .eq("salon_id", payload.salonId)
            .eq("user_id", payload.userId)
            .maybeSingle();
          if (!member || member.role === "staff") return redirect(origin, "forbidden");
          const tokens = await exchangeSquareCode(code);
          const profile = await fetchMerchantProfile(tokens);
          await saveSquareConnection(payload.salonId, payload.userId, tokens, profile.locationId, profile.businessName);
          // This salon's bookings now flow through its own Square Appointments.
          await supabaseAdmin.from("salons").update({ booking_provider: "square" }).eq("id", payload.salonId);
          return redirect(origin, "connected");
        } catch (e) {
          console.error("square oauth callback", e instanceof Error ? e.message : e);
          return redirect(origin, "error");
        }
      },
    },
  },
});
