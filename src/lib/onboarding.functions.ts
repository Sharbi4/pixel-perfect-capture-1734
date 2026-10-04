import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onboardingSchema } from "./onboarding-model";
export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => onboardingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { ownedSalonPrivate } = await import("./jobs.server");
    const { requirePaidAccess } = await import("./billing.server");
    const salon = await ownedSalonPrivate(context.supabase, context.userId);
    requirePaidAccess(salon);
    if (!salon) throw Error("Salon not found.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: current, error } = await supabaseAdmin
        .from("salons")
        .select("setup_draft,setup_revision")
        .eq("id", salon.id)
        .single();
      if (error) throw error;
      const draft =
        current.setup_draft &&
        typeof current.setup_draft === "object" &&
        !Array.isArray(current.setup_draft)
          ? current.setup_draft
          : {};
      const { data: updated, error: writeError } = await supabaseAdmin
        .from("salons")
        .update({
          setup_draft: { ...draft, onboarding: data },
          setup_revision: current.setup_revision + 1,
        })
        .eq("id", salon.id)
        .eq("setup_revision", current.setup_revision)
        .select("id")
        .maybeSingle();
      if (writeError) throw writeError;
      if (updated) return { ok: true };
    }
    throw Error("Setup changed in another tab. Please retry saving.");
  });

export const selectNativeCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownedSalonPrivate } = await import("./jobs.server");
    const { requirePaidAccess } = await import("./billing.server");
    const salon = await ownedSalonPrivate(context.supabase, context.userId);
    requirePaidAccess(salon);
    if (!salon) throw Error("Salon not found.");
    if (salon.plan_tier === "essential" && !salon.scheduling_addon)
      throw Error(
        "Ask your launch team to activate the $79/month scheduling add-on, or connect Square or Google Calendar.",
      );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("salons")
      .update({ booking_provider: "salon_pro" })
      .eq("id", salon.id);
    if (error) throw error;
    return { ok: true };
  });
