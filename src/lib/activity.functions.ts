import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Any member of the location may refresh its history; provider IDs stay server-side. */
export const syncActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid(), kind: z.enum(["calls", "messages"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase.from("salon_members").select("id").eq("salon_id", data.salonId).eq("user_id", context.userId).maybeSingle();
    if (!member) return { ok: false };
    const { adminClient } = await import("./jobs.server");
    const sb = await adminClient();
    const { data: s } = await sb.from("salons").select("agent_id,phone_number").eq("id", data.salonId).single();
    if (!s) return { ok: false };
    const a = await import("./activity.server");
    try {
      const ok = data.kind === "calls" ? await a.syncCalls(sb, data.salonId, s.agent_id) : await a.syncMessages(sb, data.salonId, s.phone_number);
      return { ok };
    } catch (e) { console.error("activity sync failed", e); return { ok: false }; }
  });
