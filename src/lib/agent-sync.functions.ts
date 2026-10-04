import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner or manager pushes the latest salon setup to that salon's own agent. */
export const syncAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase.from("salon_members").select("role").eq("salon_id", data.salonId).eq("user_id", context.userId).maybeSingle();
    if (!m || m.role === "staff") throw new Error("Only owners and managers can update the Salon Agent.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncSalonAgent } = await import("./agent-sync.server");
    return { result: await syncSalonAgent(supabaseAdmin, data.salonId) };
  });
