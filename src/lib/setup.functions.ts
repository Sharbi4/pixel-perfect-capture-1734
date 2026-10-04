import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const extractInput = z.object({
  kind: z.enum(["website", "file", "text"]),
  url: z.string().max(500).optional(),
  fileBase64: z.string().max(14_000_000).optional(),
  mediaType: z.string().max(100).optional(),
  text: z.string().max(60_000).optional(),
});

export const extractServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => extractInput.parse(d))
  .handler(async ({ data }) => {
    const { extractServicesWithAI } = await import("./ai.server");
    try {
      if (data.kind === "website") {
        let url = (data.url ?? "").trim();
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
        const u = new URL(url);
        if (!/^https?:$/.test(u.protocol)) throw new Error("Please enter a website address.");
        const res = await fetch(u.toString(), { headers: { "User-Agent": "Mozilla/5.0 SalonProAgentBot" } });
        if (!res.ok) throw new Error("We couldn't open that website.");
        const html = await res.text();
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .slice(0, 50_000);
        return { services: await extractServicesWithAI([{ type: "text", text: `Website text:\n${text}` }]), error: null };
      }
      if (data.kind === "text") {
        return { services: await extractServicesWithAI([{ type: "text", text: data.text ?? "" }]), error: null };
      }
      const mt = data.mediaType ?? "";
      const b64 = data.fileBase64 ?? "";
      if (mt.startsWith("image/")) {
        return { services: await extractServicesWithAI([{ type: "text", text: "Service menu photo:" }, { type: "image", image: b64, mediaType: mt }]), error: null };
      }
      if (mt === "application/pdf") {
        return { services: await extractServicesWithAI([{ type: "text", text: "Service menu PDF:" }, { type: "file", data: b64, mediaType: mt, filename: "menu.pdf" }]), error: null };
      }
      const decoded = Buffer.from(b64, "base64").toString("utf8").slice(0, 50_000);
      return { services: await extractServicesWithAI([{ type: "text", text: `Price list:\n${decoded}` }]), error: null };
    } catch (e) {
      console.error(e);
      return { services: [], error: e instanceof Error ? e.message : "Import failed." };
    }
  });

type LaunchResult = { status: "done" | "in_progress" | "needs_review" | "failed"; error: string | null };

export const launchSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ idempotencyKey: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LaunchResult> => {
    const { supabase, userId } = context;
    const { ownedSalonPrivate } = await import("./jobs.server");
    const salon = await ownedSalonPrivate(supabase, userId);
    if (!salon) return { status: "failed", error: "Salon not found." };
    const { data: services } = await supabase
      .from("services").select("name,price,minutes,is_addon").eq("salon_id", salon.id).eq("archived", false).order("position");
    const svc = (services ?? []).map((s) => ({ ...s, price: Number(s.price) }));

    const agent = await import("./agent.server");
    const { setupMessage } = await import("./phone-status");
    if (!agent.agentConfigured()) return { status: "failed", error: setupMessage("not_configured") };

    const { jobStore, adminClient } = await import("./jobs.server");
    const sb = await adminClient();
    await sb.from("salons").update({
      status: salon.status === "draft" ? "setting_up" : salon.status,
      launched_at: salon.launched_at ?? new Date().toISOString(),
    }).eq("id", salon.id);

    if (salon.agent_id) {
      const { syncSalonAgent } = await import("./agent-sync.server");
      const ok = (await syncSalonAgent(sb, salon.id)) === "synced";
      await sb.from("salons").update({ agent_error: ok ? "" : "update_failed", status: "agent_ready" }).eq("id", salon.id);
      return ok ? { status: "done", error: null } : { status: "failed", error: "We couldn't update your receptionist just now. Please try again." };
    }

    const { runAgentCreate } = await import("./provisioning");
    try {
      const r = await runAgentCreate(
        { ...jobStore(salon.id, "create_agent"), create: (marker) => agent.createAgent(salon, svc, marker) },
        `agent:${salon.id}:${data.idempotencyKey}`,
      );
      if (r.status === "done") await sb.from("salons").update({ status: "agent_ready", agent_sync_status: "synced", last_synced_at: new Date().toISOString(), agent_synced_version: salon.config_version }).eq("id", salon.id);
      return {
        status: r.status,
        error: r.status === "done" ? null
          : r.status === "in_progress" ? "Your receptionist is already being built."
          : setupMessage(r.code),
      };
    } catch (e) {
      console.error("launchSalon", e);
      return { status: "needs_review", error: setupMessage("check_failed") };
    }
  });

export const getTestCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownedSalonPrivate } = await import("./jobs.server");
    const salon = await ownedSalonPrivate(context.supabase, context.userId);
    if (!salon?.agent_id) throw new Error("Your receptionist isn't built yet.");
    const { agentToken } = await import("./agent.server");
    return { token: await agentToken(salon.agent_id) };
  });
