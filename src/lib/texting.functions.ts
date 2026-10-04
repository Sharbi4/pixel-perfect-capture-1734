import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A team member sends a text from the salon's number. Sending switches the thread to human takeover. */
export const sendText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid(), to: z.string().regex(/^\+\d{8,15}$/), body: z.string().trim().min(1).max(1600) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase.from("salon_members").select("id").eq("salon_id", data.salonId).eq("user_id", context.userId).maybeSingle();
    if (!member) return { ok: false, error: "You don't have access to this salon." };
    const { adminClient } = await import("./jobs.server");
    const sb = await adminClient();
    const { data: s } = await sb.from("salons").select("phone_number").eq("id", data.salonId).single();
    if (!s?.phone_number) return { ok: false, error: "This salon doesn't have a texting number yet." };
    await sb.from("sms_threads").upsert({ salon_id: data.salonId, customer_phone: data.to, ai_enabled: false, updated_at: new Date().toISOString() }, { onConflict: "salon_id,customer_phone" });
    const { sendSms } = await import("./texting.server");
    const ok = await sendSms(sb, { salonId: data.salonId, from: s.phone_number, to: data.to, body: data.body, sentBy: "staff", userId: context.userId });
    return ok ? { ok: true } : { ok: false, error: "The text couldn't be sent. Please try again." };
  });
