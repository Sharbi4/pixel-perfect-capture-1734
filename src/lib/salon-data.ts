import { supabase } from "@/integrations/supabase/client";
import { starterServices } from "./voices";

export type Salon = {
  id: string; name: string; address: string; phone: string; website: string; hours: string;
  languages: string[]; contact_name: string; voice: string; deposit_policy: string;
  cancellation_policy: string; walk_ins: boolean; booking_app: string; setup_method: string;
  status: string; launched_at: string | null; agent_id: string; agent_error: string; phone_number: string; phone_number_sid: string;
};
export type Service = { id?: string; name: string; price: number; minutes: number; is_addon: boolean };

export async function loadOrCreateSalon(): Promise<{ salon: Salon; services: Service[] }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user!.id;
  let { data: salon } = await supabase.from("salons").select("*").eq("owner_id", uid).maybeSingle();
  if (!salon) {
    const ins = await supabase.from("salons").insert({ owner_id: uid }).select("*").single();
    if (ins.error) throw ins.error;
    salon = ins.data;
    await supabase.from("services").insert(starterServices.map((s, i) => ({ ...s, salon_id: salon!.id, position: i })));
  }
  const { data: services } = await supabase.from("services").select("*").eq("salon_id", salon.id).order("position");
  return { salon: salon as Salon, services: (services ?? []).map((s) => ({ ...s, price: Number(s.price) })) };
}

export async function saveSalon(id: string, patch: Partial<Salon>) {
  const { error } = await supabase.from("salons").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function saveServices(salonId: string, list: Service[]) {
  await supabase.from("services").delete().eq("salon_id", salonId);
  const rows = list.filter((s) => s.name.trim()).map((s, i) => ({
    salon_id: salonId, name: s.name.trim(), price: s.price || 0, minutes: s.minutes || 30, is_addon: s.is_addon, position: i,
  }));
  if (rows.length) {
    const { error } = await supabase.from("services").insert(rows);
    if (error) throw error;
  }
}
