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
        // Tenant comes only from the verified key; the salon must own a dedicated agent.
        const { data: owner } = await sb.from("salons").select("agent_id").eq("id", salonId).maybeSingle();
        if (!owner?.agent_id) return new Response("Forbidden", { status: 403 });
        const ad = await (await import("@/lib/booking-adapters.server")).adapterFor(sb, salonId);
        const phone = b.client_phone ?? "";
        const base = { service: b.service ?? "", start: b.start ?? "", technician: b.technician, client_name: b.client_name ?? "", client_phone: phone, source: "ai_call" as const, call_ref: b.conversation_id, notes: b.notes };
        let out: unknown;
        switch (tool) {
          case "get_services": out = await ad.getServices(); break;
          case "get_staff": out = await ad.getStaff(); break;
          case "check_availability": out = await ad.checkAvailability({ date: b.date, service: b.service, staff: b.technician }); break;
          case "book_appointment": out = b.service && b.start ? await ad.createBooking(base) : { error: "Need service and start." }; break;
          case "find_my_appointments": out = await ad.getBookings(phone); break;
          case "reschedule_appointment": out = b.appointment_id && b.service && b.start ? await ad.rescheduleBooking(b.appointment_id, base) : { error: "Need appointment_id, service and start." }; break;
          case "cancel_appointment": out = b.appointment_id ? await ad.cancelBooking(b.appointment_id, phone) : { error: "Need appointment_id." }; break;
          case "add_to_waitlist": out = await ad.addWaitlist({ client_name: b.client_name ?? "", client_phone: phone, service: b.service, technician: b.technician, preferred: b.preferred, source: "ai_call" }); break;
          default: return Response.json({ error: "Unknown tool" }, { status: 404 });
        }
        return Response.json(out);
      },
    },
  },
});
