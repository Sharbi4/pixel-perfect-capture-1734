import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

const sorry = (msg: string) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${msg}</Say></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );

export const Route = createFileRoute("/api/public/incoming-call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const k = url.searchParams.get("k") ?? "";
        const secret = process.env["TWILIO_WEBHOOK_SECRET"] ?? "";
        const a = Buffer.from(k), b = Buffer.from(secret);
        if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Forbidden", { status: 403 });
        }
        const salonId = url.searchParams.get("salon") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(salonId)) return new Response("Bad request", { status: 400 });

        const form = await request.formData();
        const from = String(form.get("From") ?? "");
        const to = String(form.get("To") ?? "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: salon } = await supabaseAdmin.from("salons").select("agent_id").eq("id", salonId).single();
        if (!salon?.agent_id) return sorry("Sorry, this salon's line is not set up yet. Please call back later.");

        const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/register-call", {
          method: "POST",
          headers: { "xi-api-key": process.env["ELEVENLABS_API_KEY"] ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: salon.agent_id, from_number: from, to_number: to, direction: "inbound" }),
        });
        if (!res.ok) {
          console.error(`register-call failed [${res.status}]: ${await res.text()}`);
          return sorry("Sorry, we are having trouble answering right now. Please call back in a few minutes.");
        }
        return new Response(await res.text(), { headers: { "Content-Type": "text/xml" } });
      },
    },
  },
});
