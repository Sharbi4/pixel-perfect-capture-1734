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
        const res = await fetch(u.toString(), { headers: { "User-Agent": "Mozilla/5.0 NailDeskBot" } });
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

export const launchSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: salon, error } = await supabase.from("salons").select("*").eq("owner_id", userId).single();
    if (error || !salon) throw new Error("Salon not found.");
    const { data: services } = await supabase
      .from("services").select("name,price,minutes,is_addon").eq("salon_id", salon.id).order("position");
    const { upsertAgent } = await import("./agent.server");
    try {
      const agentId = await upsertAgent(salon, services ?? []);
      await supabase.from("salons").update({
        agent_id: agentId, agent_error: "", status: "agent_ready",
        launched_at: salon.launched_at ?? new Date().toISOString(),
      }).eq("id", salon.id);
      return { ok: true, error: null as string | null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      await supabase.from("salons").update({ agent_error: msg, status: "setting_up" }).eq("id", salon.id);
      return { ok: false, error: msg };
    }
  });

export const getTestCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: salon } = await context.supabase
      .from("salons").select("agent_id").eq("owner_id", context.userId).single();
    if (!salon?.agent_id) throw new Error("Your receptionist isn't built yet.");
    const { agentToken } = await import("./agent.server");
    return { token: await agentToken(salon.agent_id) };
  });
