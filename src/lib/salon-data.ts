import { supabase } from "@/integrations/supabase/client";
import { starterServices } from "./voices";
import type { PhoneSetup } from "./phone-status";

// Explicit, customer-safe columns only (provider IDs are never readable by customers).
const SALON_COLS =
  "id,setup_draft,name,address,phone,website,hours,languages,contact_name,voice,deposit_policy,cancellation_policy,walk_ins,booking_app,setup_method,status,launched_at,has_receptionist,agent_error,phone_number";
const SETUP_COLS =
  "salon_id,business_number,portability_status,agent_status,agent_error,temp_number_status,temp_number_error,voice_status,forwarding_status,texting_status,updated_at";

export type Salon = {
  setup_draft?: unknown;
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  hours: string;
  languages: string[];
  contact_name: string;
  voice: string;
  deposit_policy: string;
  cancellation_policy: string;
  walk_ins: boolean;
  booking_app: string;
  setup_method: string;
  status: string;
  launched_at: string | null;
  has_receptionist: boolean;
  agent_error: string;
  phone_number: string;
};
export type Service = {
  id?: string;
  name: string;
  price: number;
  minutes: number;
  is_addon: boolean;
};

export async function loadOrCreateSalon(): Promise<{ salon: Salon; services: Service[] }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in to load your salon.");
  const uid = u.user.id;
  let { data: salon, error: loadError } = await supabase
    .from("salons")
    .select(SALON_COLS)
    .eq("owner_id", uid)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!salon) {
    const ins = await supabase.from("salons").insert({ owner_id: uid }).select(SALON_COLS).single();
    if (ins.error?.code === "23505") {
      // Another tab created it first (one salon per owner).
      salon = (await supabase.from("salons").select(SALON_COLS).eq("owner_id", uid).single()).data;
      if (!salon) throw ins.error;
    } else if (ins.error) throw ins.error;
    else {
      salon = ins.data;
      const { error } = await supabase
        .from("services")
        .insert(starterServices.map((s, i) => ({ ...s, salon_id: salon!.id, position: i })));
      if (error) throw error;
    }
  }
  const { data: services, error: serviceError } = await supabase
    .from("services")
    .select("id,name,price,minutes,is_addon")
    .eq("salon_id", salon.id)
    .eq("archived", false)
    .order("position");
  if (serviceError) throw serviceError;
  return {
    salon: salon as unknown as Salon,
    services: (services ?? []).map((s) => ({ ...s, price: Number(s.price) })),
  };
}

// Only owner-editable fields; provider IDs, status and owner are backend-controlled.
export const EDITABLE_SALON_FIELDS = [
  "name",
  "address",
  "phone",
  "website",
  "hours",
  "languages",
  "contact_name",
  "voice",
  "deposit_policy",
  "cancellation_policy",
  "walk_ins",
  "booking_app",
  "setup_method",
] as const;

export async function saveSalon(id: string, patch: Partial<Salon>) {
  const safe: Record<string, unknown> = {};
  for (const k of EDITABLE_SALON_FIELDS) if (k in patch) safe[k] = patch[k];
  const { error } = await supabase
    .from("salons")
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function saveServices(salonId: string, list: Service[]) {
  // Preserve stable service IDs referenced by appointments and team assignments.
  const { data: existing, error: readError } = await supabase
    .from("services")
    .select("id")
    .eq("salon_id", salonId)
    .eq("archived", false);
  if (readError) throw readError;
  const kept = new Set<string>();
  for (const [position, s] of list.filter((x) => x.name.trim()).entries()) {
    const values = {
      name: s.name.trim(),
      price: s.price || 0,
      minutes: s.minutes || 30,
      is_addon: s.is_addon,
      position,
      archived: false,
    };
    if (s.id) {
      const { data, error } = await supabase
        .from("services")
        .update(values)
        .eq("id", s.id)
        .eq("salon_id", salonId)
        .select("id")
        .single();
      if (error) throw error;
      kept.add(data.id);
    } else {
      const { data, error } = await supabase
        .from("services")
        .insert({ ...values, salon_id: salonId })
        .select("id")
        .single();
      if (error) throw error;
      s.id = data.id;
      kept.add(data.id);
    }
  }
  const removed = (existing ?? []).map((x) => x.id).filter((id) => !kept.has(id));
  if (removed.length) {
    const { error } = await supabase
      .from("services")
      .update({ archived: true })
      .eq("salon_id", salonId)
      .in("id", removed);
    if (error) throw error;
  }
}

export async function loadPhoneSetup(salonId: string): Promise<PhoneSetup | null> {
  const { data, error } = await supabase
    .from("phone_setups")
    .select(SETUP_COLS)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PhoneSetup | null) ?? null;
}
