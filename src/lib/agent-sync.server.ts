// Pushes a salon's current setup to its own dedicated voice agent. Never creates a new agent:
// creation goes only through the phone_jobs path in launchSalon.
import type { supabaseAdmin } from "@/integrations/supabase/client.server";

type Admin = typeof supabaseAdmin;

export async function syncSalonAgent(sb: Admin, salonId: string): Promise<"synced" | "failed" | "no_agent"> {
  const { data: s } = await sb.from("salons").select("*").eq("id", salonId).single();
  if (!s?.agent_id) return "no_agent";
  const version = s.config_version;
  await sb.from("salons").update({ agent_sync_status: "syncing" }).eq("id", salonId);
  const [{ data: services }, { data: staff }] = await Promise.all([
    sb.from("services").select("id,name,price,minutes,is_addon").eq("salon_id", salonId).order("position"),
    sb.from("staff").select("name,service_ids,hours").eq("salon_id", salonId).eq("active", true).order("position"),
  ]);
  const { updateAgent } = await import("./agent.server");
  const ok = await updateAgent(s.agent_id, { ...s, id: salonId }, (services ?? []).map((x) => ({ ...x, price: Number(x.price) })), staff ?? []).catch(() => false);
  // Only mark synced if nothing changed while we were pushing.
  const { data: now } = await sb.from("salons").select("config_version").eq("id", salonId).single();
  const fresh = ok && now?.config_version === version;
  await sb.from("salons").update({
    agent_sync_status: ok ? (fresh ? "synced" : "update_required") : "failed",
    ...(ok ? { agent_synced_version: version, last_synced_at: new Date().toISOString(), agent_error: "" } : {}),
  }).eq("id", salonId);
  return ok ? "synced" : "failed";
}
