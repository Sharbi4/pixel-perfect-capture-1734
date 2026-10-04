import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Booking tools the voice agent calls during a live call. Protected by a per-salon key in the URL.
const Body = z.object({
  date: z.string().max(10).optional(), service: z.string().max(120).optional(), technician: z.string().max(60).optional(),
  start: z.string().max(40).optional(), client_name: z.string().max(120).optional(), client_phone: z.string().max(30).optional(),
  appointment_id: z.string().uuid().optional(), preferred: z.string().max(300).optional(), notes: z.string().max(500).optional(),
  conversation_id: z.string().max(80).optional(),
});

export const Route = createFileRoute("/api/public/agent-tools")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const salonId = url.searchParams.get("salon") ?? "";
        const tool = url.searchParams.get("tool") ?? "";
        const { checkToolKey } = await import("@/lib/booking.server");
        if (!/^[0-9a-f-]{36}$/i.test(salonId) || !checkToolKey(salonId, url.searchParams.get("k") ?? "")) return new Response("Forbidden", { status: 403 });
        const parsed = Body.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
        const b = parsed.data;
        const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
        const bk = await import("@/lib/booking.server");
        const phone = b.client_phone ?? "";
        let out: unknown;
        switch (tool) {
          case "check_availability": out = await bk.findSlots(sb, salonId, { date: b.date, service: b.service, staff: b.technician }); break;
          case "book_appointment":
            if (!b.service || !b.start) { out = { error: "Need service and start." }; break; }
            out = await bk.book(sb, salonId, { service: b.service, start: b.start, technician: b.technician, client_name: b.client_name ?? "", client_phone: phone, source: "ai_call", call_ref: b.conversation_id, notes: b.notes });
            break;
          case "find_my_appointments": out = await bk.lookup(sb, salonId, phone); break;
          case "reschedule_appointment":
            if (!b.appointment_id || !b.service || !b.start) { out = { error: "Need appointment_id, service and start." }; break; }
            out = await bk.book(sb, salonId, { service: b.service, start: b.start, technician: b.technician, client_name: b.client_name ?? "", client_phone: phone, source: "ai_call", call_ref: b.conversation_id, reschedule_id: b.appointment_id });
            break;
          case "cancel_appointment": out = b.appointment_id ? await bk.cancel(sb, salonId, phone, b.appointment_id) : { error: "Need appointment_id." }; break;
          case "add_to_waitlist": out = await bk.addWaitlist(sb, salonId, { client_name: b.client_name ?? "", client_phone: phone, service: b.service, technician: b.technician, preferred: b.preferred, source: "ai_call" }); break;
          default: return Response.json({ error: "Unknown tool" }, { status: 404 });
        }
        return Response.json(out);
      },
    },
  },
});
