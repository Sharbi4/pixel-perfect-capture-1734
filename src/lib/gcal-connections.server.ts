// Server-only storage for each salon's Google Calendar connection key. Written and read only
// by server functions after a salon_members role check — never granted to browser clients.
import { decryptConnectionKey, encryptConnectionKey } from "./connectionKeyCrypto.server";

export type SalonConnection = { calendarId: string; calendarSummary: string; connectionKey: string; updatedAt: string };

export async function getSalonConnection(salonId: string): Promise<SalonConnection | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("salon_calendar_connections")
    .select("calendar_id,calendar_summary,connection_key_ciphertext,updated_at")
    .eq("salon_id", salonId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) { console.error("gcal connection read", error.message); throw new Error("Couldn't read your Google Calendar connection. Please try again."); }
  if (!data?.connection_key_ciphertext) return null;
  return {
    calendarId: data.calendar_id || "primary",
    calendarSummary: data.calendar_summary ?? "",
    connectionKey: decryptConnectionKey(data.connection_key_ciphertext),
    updatedAt: data.updated_at,
  };
}

export async function saveSalonConnection(salonId: string, userId: string, connectionKey: string, calendarId = "primary", calendarSummary = "") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("salon_calendar_connections").upsert(
    {
      salon_id: salonId,
      provider: "google",
      user_id: userId,
      calendar_id: calendarId,
      calendar_summary: calendarSummary,
      connection_key_ciphertext: encryptConnectionKey(connectionKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "salon_id" },
  );
  if (error) { console.error("gcal connection save", error.message); throw new Error("Couldn't save your Google Calendar connection. Please try again."); }
}

export async function deleteSalonConnection(salonId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("salon_calendar_connections").delete().eq("salon_id", salonId).eq("provider", "google");
  if (error) { console.error("gcal connection delete", error.message); throw new Error("Couldn't remove your Google Calendar connection. Please try again."); }
}
