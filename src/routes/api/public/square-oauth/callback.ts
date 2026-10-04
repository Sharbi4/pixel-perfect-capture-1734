// Square sends each salon owner back here after they approve access. The one-time `state`
// ties the response to the salon + user who started it; tokens are exchanged and stored
// encrypted server-side, then the popup closes. Nothing secret is ever put in the page.
import { createFileRoute } from "@tanstack/react-router";

function page(ok: boolean, msg: string) {
  const safe = msg.replace(/[<>&"]/g, "");
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Square</title><body style="font-family:system-ui;padding:40px;text-align:center"><p>${safe}</p><p style="color:#888;font-size:14px">You can close this window.</p><script>try{window.opener&&window.opener.postMessage({type:"squareOAuth",ok:${ok}},"*")}catch(e){}setTimeout(function(){window.close()},1200)</script></body>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/public/square-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        if (!/^[A-Za-z0-9_-]{20,100}$/.test(state)) return page(false, "This Square link is invalid. Please start again from Salon Pro Agent.");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;
        // One-time: consume the state whether or not the rest succeeds.
        const { data: st } = await sb.from("square_oauth_states").delete().eq("nonce", state).select("salon_id,user_id,expires_at").maybeSingle();
        if (!st || Date.parse(st.expires_at) < Date.now()) return page(false, "This Square link expired. Please start again from Salon Pro Agent.");
        if (url.searchParams.get("error") || !code) return page(false, "Square access wasn't granted.");
        const { data: allowed } = await sb.rpc("can_manage_salon", { _salon: st.salon_id, _user: st.user_id });
        if (!allowed) return page(false, "Only owners and managers can connect Square.");
        try {
          const { exchangeToken, saveSquareTokens, getSquareConnection, squareApi } = await import("@/lib/square-client.server");
          const t = await exchangeToken({ grant_type: "authorization_code", code });
          await saveSquareTokens(st.salon_id, st.user_id, t);
          // Fill in business + first active location so the owner sees who they connected.
          const conn = await getSquareConnection(st.salon_id);
          if (conn) {
            const extra: Record<string, string> = {};
            try {
              const m = await squareApi(conn, `/v2/merchants/${encodeURIComponent(conn.merchantId)}`);
              extra["merchant_name"] = String(m?.merchant?.business_name ?? "").slice(0, 200);
            } catch (e) { console.error("square merchant", (e as Error).message); }
            try {
              const l = await squareApi(conn, "/v2/locations");
              const locs = (l?.locations ?? []).filter((x: any) => x.status === "ACTIVE");
              if (locs.length === 1 || (locs.length && !conn.locationId)) {
                extra["location_id"] = locs[0].id;
                extra["location_name"] = String(locs[0].name ?? "").slice(0, 200);
              }
            } catch (e) { console.error("square locations", (e as Error).message); }
            if (Object.keys(extra).length) await sb.from("salon_square_connections").update(extra).eq("salon_id", st.salon_id);
          }
          return page(true, "Square is connected to Salon Pro Agent.");
        } catch (e) {
          console.error("square oauth callback", (e as Error).message);
          return page(false, "We couldn't finish connecting Square. Please try again.");
        }
      },
    },
  },
});
