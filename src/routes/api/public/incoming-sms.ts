import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

const EMPTY = () => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { headers: { "Content-Type": "text/xml" } });

// Incoming texts for a salon number. Requires the URL secret and a To number that matches the salon.
export const Route = createFileRoute("/api/public/incoming-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const k = url.searchParams.get("k") ?? "";
        const secret = process.env["TWILIO_WEBHOOK_SECRET"] ?? "";
        const a = Buffer.from(k), b = Buffer.from(secret);
        if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Forbidden", { status: 403 });
        const salonId = url.searchParams.get("salon") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(salonId)) return new Response("Bad request", { status: 400 });

        const form = await request.formData();
        const sid = String(form.get("MessageSid") ?? "");
        const from = String(form.get("From") ?? "");
        const to = String(form.get("To") ?? "");
        const body = String(form.get("Body") ?? "").slice(0, 1600);
        if (!/^(SM|MM)[0-9a-f]{32}$/i.test(sid) || !/^\+\d{8,15}$/.test(from)) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
        const { data: salon } = await sb.from("salons").select("phone_number").eq("id", salonId).single();
        if (!salon?.phone_number || salon.phone_number !== to) return new Response("Forbidden", { status: 403 });

        const { data: fresh } = await sb.from("messages").upsert({
          salon_id: salonId, provider_ref: sid, sent_at: new Date().toISOString(), direction: "inbound",
          customer_phone: from, body, status: "received", sent_by: "customer",
        }, { onConflict: "provider_ref", ignoreDuplicates: true }).select("id");
        await sb.from("sms_threads").upsert({ salon_id: salonId, customer_phone: from, updated_at: new Date().toISOString() }, { onConflict: "salon_id,customer_phone" });
        // Provider retries arrive with the same id: only reply once.
        if (fresh?.length) {
          const { agentReply } = await import("@/lib/texting.server");
          await agentReply(sb, salonId, to, from, body);
        }
        return EMPTY();
      },
    },
  },
});
