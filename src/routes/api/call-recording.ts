import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Streams a call recording to a signed-in member of that call's salon. Provider IDs never leave the server.
export const Route = createFileRoute("/api/call-recording")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id") ?? "";
        const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
        if (!token || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return new Response("Please sign in", { status: 401 });
        // RLS: only members of the call's salon can see the row.
        const { data: call } = await sb.from("calls").select("id").eq("id", id).maybeSingle();
        if (!call) return new Response("Not found", { status: 404 });
        const { adminClient } = await import("@/lib/jobs.server");
        const admin = await adminClient();
        const { data: row } = await admin.from("calls").select("provider_ref").eq("id", id).single();
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!row || !key) return new Response("Recording unavailable", { status: 404 });
        const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(row.provider_ref)}/audio`, { headers: { "xi-api-key": key }, signal: request.signal });
        if (!res.ok || !res.body) { console.error("recording fetch", res.status); return new Response("Recording unavailable", { status: 404 }); }
        return new Response(res.body, { headers: { "Content-Type": res.headers.get("content-type") ?? "audio/mpeg", "Cache-Control": "private, no-store" } });
      },
    },
  },
});
