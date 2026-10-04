import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AgentSettingsSchema, LANGUAGES, langLabel } from "./agent-settings";
import { voices } from "./voices";

const Id = z.object({ salonId: z.string().uuid() });

async function role(sb: { from: (t: "salon_members") => any }, salonId: string, userId: string): Promise<string | null> {
  const { data } = await sb.from("salon_members").select("role").eq("salon_id", salonId).eq("user_id", userId).maybeSingle();
  return data?.role ?? null;
}

/** Owner/manager saves structured settings; the server writes them and immediately re-syncs that salon's own agent. */
export const saveAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ settings: AgentSettingsSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw new Error("Only owners and managers can change the Salon Agent.");
    const s = data.settings;
    if (!voices.some((v) => v.id === s.voice)) throw new Error("Please pick one of the listed voices.");
    s.extra_languages = [...new Set(s.extra_languages)].filter((l) => l !== s.default_language);
    const languages = [s.default_language, ...s.extra_languages].map(langLabel).filter((l) => LANGUAGES.some((x) => x.label === l));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("salons").update({ agent_settings: s, voice: s.voice, languages, updated_at: new Date().toISOString() }).eq("id", data.salonId);
    if (error) { console.error("save agent settings", error.message); throw new Error("Couldn't save your settings. Please try again."); }
    const { syncSalonAgent } = await import("./agent-sync.server");
    return { sync: await syncSalonAgent(supabaseAdmin, data.salonId) };
  });

/** Browser test call for any member of this location, using that location's own agent. */
export const getLocationTestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await role(context.supabase, data.salonId, context.userId))) throw new Error("You don't have access to this location.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("salons").select("agent_id").eq("id", data.salonId).single();
    if (!s?.agent_id) throw new Error("Your Salon Agent isn't built yet. Finish setup to test it.");
    const { agentToken } = await import("./agent.server");
    return { token: await agentToken(s.agent_id) };
  });
