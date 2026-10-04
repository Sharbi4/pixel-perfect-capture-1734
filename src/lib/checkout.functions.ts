import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { initialDraft } from "./setup-model";
import type { Purchase } from "./checkout-workflow";
import type { Json } from "@/integrations/supabase/types";
export const claimCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: u, error: authError } = await context.supabase.auth.getUser();
    if (authError || !u.user?.email_confirmed_at || !u.user.email)
      throw Error("Verify your purchase email before finishing account setup.");
    const { adminClient } = await import("./jobs.server"),
      sb = await adminClient();
    const { data: rows, error } = await sb
      .from("checkout_purchases")
      .select("*")
      .eq("email", u.user.email.toLowerCase())
      .eq("state", "paid")
      .order("created_at", { ascending: false });
    if (error) throw Error("We couldn't check your payment. Please try again.");
    const p = (rows?.find((x) => x.environment === "production") ?? rows?.[0]) as unknown as
      Purchase | undefined;
    if (!p)
      throw Error(
        "No confirmed purchase matches this email. Use the email you entered at checkout.",
      );
    const d = initialDraft(
      {
        name: p.preview.name,
        address: "",
        phone: "",
        website: p.preview.website,
        hours: "",
        contact_name: "",
        voice: p.preview.voice,
        languages: ["English"],
        cancellation_policy: "",
        walk_ins: true,
      },
      [],
    );
    d.business.owner_email = p.email;
    d.business.first_name = p.buyer.firstName;
    d.business.last_name = p.buyer.lastName;
    const { businessTypes } = await import("./setup-model");
    if ((businessTypes as readonly string[]).includes(p.preview.businessType))
      d.business.business_type = p.preview.businessType as typeof d.business.business_type;
    // Keep free-form services as an unapproved note, never an active service list.
    d.service_notes = p.preview.services;
    const { data: id, error: claimError } = await sb.rpc("claim_checkout", {
      p_owner: context.userId,
      p_email: u.user.email.toLowerCase(),
      p_draft: d as unknown as Json,
    });
    if (claimError)
      throw Error(
        "We couldn't attach this purchase to your account. Please contact support; don't purchase again.",
      );
    // Only a server-verified production purchase can assign commercial entitlements.
    if (p.environment === "production") {
      const { getPlan } = await import("./pricing");
      const tier = getPlan(p.preview.tier).id;
      const { error: entitlementError } = await sb
        .from("salons")
        .update({ plan_tier: tier, scheduling_addon: tier !== "essential" })
        .eq("id", id!)
        .eq("owner_id", context.userId);
      if (entitlementError)
        throw Error("Your payment is saved. Contact support to finish activating your plan.");
    }
    return { salonId: id, environment: p.environment, serviceNotes: p.preview.services };
  });
