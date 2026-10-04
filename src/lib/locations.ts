import { supabase } from "@/integrations/supabase/client";

// Every salon location the signed-in user can access (owner or staff), via salon_members + RLS.
export type Location = { id: string; name: string; address: string; status: string; phone_number: string; has_receptionist: boolean; role: string };

const KEY = "spa.activeLocation";

export async function listLocations(): Promise<Location[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("salon_members")
    .select("role, salon:salons(id,name,address,status,phone_number,has_receptionist)")
    .eq("user_id", u.user.id)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).flatMap((r) => {
    const s = r.salon as unknown as Omit<Location, "role"> | null;
    return s ? [{ ...s, role: r.role }] : [];
  });
}

export function getActiveLocationId(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
}
export function setActiveLocationId(id: string) {
  window.localStorage.setItem(KEY, id);
}

/** "123 Main St, Tucson, AZ 85701" -> "Tucson, AZ" */
export function cityLine(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(" ")[0]}`;
  return parts.slice(-1)[0] ?? "Address not added";
}
