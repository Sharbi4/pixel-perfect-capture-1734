import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getBillingSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: salon, error } = await context.supabase
      .from("salons")
      .select("id,plan_tier,paid_access_until")
      .eq("id", data.salonId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error || !salon) throw Error("Only the salon owner can view billing.");
    const { adminClient } = await import("./jobs.server");
    const sb = await adminClient();
    const { data: purchases, error: purchaseError } = await sb
      .from("checkout_purchases")
      .select("id,created_at,plan_name,state,environment,total_cents,monthly_cents,paid_through")
      .eq("owner_id", context.userId)
      .eq("environment", "production")
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: legacy, error: legacyError } = await context.supabase
      .from("payments")
      .select("id,created_at,amount_cents,currency,status,kind")
      .eq("salon_id", data.salonId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (purchaseError || legacyError) throw Error("We couldn't load billing. Please try again.");
    return {
      planTier: salon.plan_tier,
      paidUntil: salon.paid_access_until,
      purchases: purchases ?? [],
      legacy: legacy ?? [],
    };
  });
