import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner-readable payment status for the signed-in user's salon. */
export const getPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: salon } = await context.supabase
      .from("salons")
      .select("id,paid_access_until")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!salon) return { paid: false as const, status: "none" as const };
    if (salon.paid_access_until && Date.parse(salon.paid_access_until) > Date.now()) return { paid: true, status: "paid" as const };
    const { data: payment } = await context.supabase
      .from("payments")
      .select("status")
      .eq("salon_id", salon.id)
      .eq("kind", "setup")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!payment) return { paid: false as const, status: "none" as const };
    return {
      paid: payment.status === "paid",
      status: payment.status as "pending" | "paid" | "failed",
    };
  });

/**
 * Create a Square hosted checkout for the $1,500 setup fee.
 * Idempotent per salon: reuses an existing pending link, refuses when paid.
 */
export const createSalonCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ idempotencyKey: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: salon } = await context.supabase
      .from("salons")
      .select("id, name")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!salon) throw new Error("Save your salon details first.");

    const { data: existing } = await context.supabase
      .from("payments")
      .select("status, checkout_url")
      .eq("salon_id", salon.id)
      .eq("kind", "setup")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.status === "paid") return { url: null, alreadyPaid: true as const };
    if (existing?.status === "pending" && existing.checkout_url) {
      return { url: existing.checkout_url, alreadyPaid: false as const };
    }

    const { createSetupPaymentLink } = await import("./square.server");
    const link = await createSetupPaymentLink({
      idempotencyKey: data.idempotencyKey,
      salonId: salon.id,
      salonName: salon.name,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      salon_id: salon.id,
      kind: "setup",
      status: "pending",
      amount_cents: 150_000,
      currency: "USD",
      square_order_id: link.orderId,
      checkout_url: link.url,
    });
    if (error) {
      console.error("Failed to persist payment row", error);
      throw new Error("Couldn't start checkout. Please try again.");
    }
    return { url: link.url, alreadyPaid: false as const };
  });
