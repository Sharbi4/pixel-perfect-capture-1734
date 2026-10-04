// Browser-side data access for the scheduling screens (RLS: salon members only).
import { supabase } from "@/integrations/supabase/client";
import type { Hours, Rules, StaffLite } from "./availability";

export type Staff = StaffLite & { position: number };
export type Service = { id: string; name: string; price: number; minutes: number; is_addon: boolean };
export type Appt = {
  id: string; staff_id: string | null; service_id: string | null; service_name: string; price: number; client_name: string; client_phone: string;
  starts_at: string; ends_at: string; status: string; source: string; call_id: string | null; notes: string; text_confirmed: boolean;
  provider: string; deposit_status: string; deposit_cents: number; confirmation_sent_at: string | null;
};
export type WaitItem = { id: string; client_name: string; client_phone: string; service_name: string; staff_id: string | null; preferred: string; status: string; created_at: string };
export type SalonRules = Rules & { confirm_texts: boolean; name: string };

export const STATUS: Record<string, { label: string; cls: string }> = {
  booked: { label: "Booked", cls: "bg-violet/20 text-violet" },
  confirmed: { label: "Confirmed", cls: "bg-success/15 text-success" },
  completed: { label: "Completed", cls: "bg-accent text-muted-foreground" },
  cancelled: { label: "Cancelled", cls: "bg-coral/15 text-coral" },
  no_show: { label: "No-show", cls: "bg-coral/15 text-coral" },
};
export const SOURCE: Record<string, string> = { staff: "Staff", ai_call: "AI call", ai_text: "AI text", online: "Online" };
export const BOOKED_BY: Record<string, string> = { staff: "Staff booked", ai_call: "AI booked", ai_text: "AI booked", online: "Online booked" };
export const DEPOSIT: Record<string, string> = { none: "No deposit", required: "Deposit due", link_sent: "Payment link sent", paid: "Deposit paid", waived: "Deposit waived" };
export const PROVIDER: Record<string, string> = { salon_pro: "Salon Pro Scheduling", square: "Square", google: "Google Calendar", outlook: "Outlook", acuity: "Acuity", mindbody: "Mindbody", calendly: "Calendly" };
export const minutesOf = (a: { starts_at: string; ends_at: string }) => Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000);
export const ACTIVE = ["booked", "confirmed"];

export async function loadBasics(salonId: string) {
  const [r, s, v] = await Promise.all([
    supabase.from("salons").select("name,timezone,buffer_min,lead_min,horizon_days,confirm_texts").eq("id", salonId).single(),
    supabase.from("staff").select("id,name,service_ids,hours,active,position").eq("salon_id", salonId).order("position").order("created_at"),
    supabase.from("services").select("id,name,price,minutes,is_addon").eq("salon_id", salonId).order("position"),
  ]);
  return {
    rules: (r.data ?? { name: "", timezone: "America/Phoenix", buffer_min: 10, lead_min: 60, horizon_days: 60, confirm_texts: true }) as SalonRules,
    staff: (s.data ?? []).map((x) => ({ ...x, hours: x.hours as Hours })) as Staff[],
    services: (v.data ?? []) as Service[],
  };
}

export async function loadAppts(salonId: string, from: string, to: string) {
  const { data } = await supabase.from("appointments").select("id,staff_id,service_id,service_name,price,client_name,client_phone,starts_at,ends_at,status,source,call_id,notes,text_confirmed")
    .eq("salon_id", salonId).lt("starts_at", to).gt("ends_at", from).order("starts_at").limit(1000);
  return (data ?? []) as Appt[];
}

export async function loadTimeOff(salonId: string, from: string, to: string) {
  const { data } = await supabase.from("staff_time_off").select("id,staff_id,starts_at,ends_at,reason").eq("salon_id", salonId).lt("starts_at", to).gt("ends_at", from);
  return data ?? [];
}

/** Minutes after local midnight in the salon's zone. */
export function minutesOf(iso: string, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return Number(p["hour"]) * 60 + Number(p["minute"]);
}
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const parseHHMM = (s: string) => { const [h, m] = s.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
