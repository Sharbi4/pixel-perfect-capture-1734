import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const findNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ areaCode: z.string().regex(/^\d{0,3}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { searchNumbers } = await import("./phone.server");
    try { return { numbers: await searchNumbers(data.areaCode), error: null as string | null }; }
    catch (e) { return { numbers: [], error: (e as Error).message }; }
  });

export const claimNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ number: z.string().regex(/^\+1\d{10}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: salon } = await supabase
      .from("salons").select("id,name,agent_id,phone_number").eq("owner_id", userId).single();
    if (!salon) return { error: "Salon not found." };
    if (!salon.agent_id) return { error: "Build your receptionist first." };
    if (salon.phone_number) return { error: "Your salon already has a NailDesk number." };
    const { buyNumber, voiceUrl } = await import("./phone.server");
    try {
      const origin = new URL(getRequest().url).origin;
      const bought = await buyNumber(data.number, voiceUrl(origin, salon.id), `NailDesk — ${salon.name}`);
      await supabase.from("salons")
        .update({ phone_number: bought.number, phone_number_sid: bought.sid, status: "live" })
        .eq("id", salon.id);
      return { error: null as string | null, number: bought.number };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
