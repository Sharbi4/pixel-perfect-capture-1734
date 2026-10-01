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
    // Phone agent + number creation plugs in here once a voice-phone provider is connected.
    const { error } = await supabase
      .from("salons")
      .update({ status: "setting_up", launched_at: new Date().toISOString() })
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
