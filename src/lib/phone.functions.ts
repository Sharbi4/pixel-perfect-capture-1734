import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Result = { status: "done" | "in_progress" | "needs_review" | "failed"; code: string; number: string };

/** Intentional owner action: pick and reserve a temporary local number for the salon's receptionist. */
export const setupTemporaryNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ idempotencyKey: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result> => {
    // Ownership is proven by reading through the caller's RLS-scoped client.
    const { ownedSalonPrivate } = await import("./jobs.server");
    const salon = await ownedSalonPrivate(context.supabase, context.userId);
    if (!salon) return { status: "failed", code: "provider_rejected", number: "" };
    if (salon.phone_number) return { status: "done", code: "", number: salon.phone_number };
    if (!salon.agent_id) return { status: "failed", code: "needs_agent", number: "" };

    const { normalizeUsNumber, stateFromAddress } = await import("./phone-format");
    const business = normalizeUsNumber(salon.phone);
    if (!business) return { status: "failed", code: "needs_business_number", number: "" };

    const phone = await import("./phone.server");
    const voiceUrl = phone.callbackUrl(salon.id);
    if (!voiceUrl || !phone.phoneConfigured()) return { status: "failed", code: "not_configured", number: "" };

    const { jobStore, adminClient } = await import("./jobs.server");
    const sb = await adminClient();
    await sb.from("phone_setups").upsert({ salon_id: salon.id, business_number: business, updated_at: new Date().toISOString() });

    const { runPurchase } = await import("./provisioning");
    try {
      const r = await runPurchase(
        {
          ...jobStore(salon.id, "purchase_number"),
          searchByArea: phone.searchByArea,
          searchNearby: phone.searchNearby,
          buy: (n) => phone.buyNumber(n, voiceUrl, `Salon Agent — ${salon.name || "Salon"}`.slice(0, 64)),
        },
        { key: `purchase:${salon.id}:${data.idempotencyKey}`, businessNumber: business, addressState: stateFromAddress(salon.address) },
      );
      return { status: r.status, code: r.code, number: r.status === "done" ? r.target : "" };
    } catch (e) {
      console.error("setupTemporaryNumber", e);
      return { status: "needs_review", code: "check_failed", number: "" };
    }
  });

/** Owner action: confirm any unclear or interrupted setup step by checking (read-only) with the provider. */
export const checkSetupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: salon } = await context.supabase
      .from("salons").select("id").eq("owner_id", context.userId).maybeSingle();
    if (!salon) return { checked: 0 };
    const { openJobs, jobStore, adminClient } = await import("./jobs.server");
    const { reconcile } = await import("./provisioning");
    const { findOwnedNumber } = await import("./phone.server");
    const { findAgentByMarker } = await import("./agent.server");

    let checked = 0;
    for (const j of await openJobs(salon.id)) {
      const store = jobStore(salon.id, j.kind as "purchase_number" | "create_agent");
      let state = j.state, target = j.target;
      if (state === "in_progress") {
        // begin() flips a stale lock to uncertain; a fresh lock is left alone.
        const h = await store.begin(j.idempotency_key);
        state = h.job_state; target = h.target;
      }
      if (state !== "uncertain") continue;
      checked++;
      const r = j.kind === "purchase_number"
        ? await reconcile(store.transition, { id: j.id, target }, findOwnedNumber, "not_purchased")
        : await reconcile(store.transition, { id: j.id, target }, findAgentByMarker, "not_created");
      if (j.kind === "create_agent" && r.status === "done") {
        const sb = await adminClient();
        await sb.from("salons").update({ status: "agent_ready" }).eq("id", salon.id);
      }
    }
    return { checked };
  });
