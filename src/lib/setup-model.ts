import { z } from "zod";
import { normalizeUsNumber } from "./phone-format";

export const setupSteps = ["Business", "Services", "Team", "Receptionist", "Calendar", "Phone", "Texting", "Test", "Go Live"] as const;
export const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const businessTypes = ["Nail Salon", "Hair Salon", "Nail & Spa", "Lash/Brow Studio", "Barber Shop", "Spa", "Beauty Studio", "Other"] as const;
const text = z.string().max(2000);
const daySchema = z.object({ open: z.boolean(), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) });
const hoursSchema = z.array(daySchema).length(7);
export type DayHours = z.infer<typeof daySchema>;
export const emptyHours = (): DayHours[] => days.map(() => ({ open: false, start: "09:00", end: "17:00" }));
const serviceSchema = z.object({
  id: z.string().uuid(), name: text, price: z.number().min(0).max(100000), minutes: z.number().int().min(0).max(1440),
  is_addon: z.boolean(), category: text, description: text, price_mode: z.enum(["fixed", "starting", "range"]),
  price_max: z.number().min(0).max(100000), deposit_kind: z.enum(["none", "fixed", "percent"]),
  deposit_amount: z.number().min(0).max(100000), staff_ids: z.array(z.string().uuid()).max(100), addon_ids: z.array(z.string().uuid()).max(100),
});
export type SetupService = z.infer<typeof serviceSchema>;
export const blankService = (): SetupService => ({ id: crypto.randomUUID(), name: "", price: 0, minutes: 30, is_addon: false, category: "", description: "", price_mode: "fixed", price_max: 0, deposit_kind: "none", deposit_amount: 0, staff_ids: [], addon_ids: [] });
const teamSchema = z.object({ id: z.string().uuid(), name: text, role: text, requestable: z.boolean(), service_ids: z.array(z.string().uuid()).max(100), hours: hoursSchema, image_url: z.string().max(1000) });
export type TeamMember = z.infer<typeof teamSchema>;
export const setupDraftSchema = z.object({
  service_notes: z.string().max(6000).default(""),
  step: z.number().int().min(0).max(8),
  business: z.object({ name: text, legal_name: text, address: text, unit: text, city: text, state: text, zip: text, business_email: text, phone: text, website: text, first_name: text, last_name: text, owner_mobile: text, owner_email: text, business_type: z.enum(businessTypes), timezone: text, hours: hoursSchema, legacy_hours: text }),
  services: z.array(serviceSchema).max(100), team: z.array(teamSchema).max(100), solo: z.boolean(), any_available: z.boolean(),
  receptionist: z.object({ voice: z.enum(["mia", "linh", "ava", "sophie", "emma", "grace"]), default_language: z.enum(["English", "Vietnamese", "Spanish", "Chinese", "Korean"]), languages: z.array(z.enum(["English", "Vietnamese", "Spanish", "Chinese", "Korean"])).min(1).max(5), auto_language: z.boolean(), cancellation_policy: text, walk_ins: z.boolean(), transfer_number: text, deposit_mode: z.enum(["none", "selected", "all"]), deposit_kind: z.enum(["fixed", "percent"]), deposit_amount: z.number().min(0).max(100000) }),
  calendar: z.object({ requested: z.string().max(100) }),
});
export type SetupDraft = z.infer<typeof setupDraftSchema>;

export function initialDraft(s: { name: string; address: string; phone: string; website: string; hours: string; contact_name: string; voice: string; languages: string[]; cancellation_policy: string; walk_ins: boolean }, services: { id?: string; name: string; price: number; minutes: number; is_addon: boolean }[]): SetupDraft {
  return {
    service_notes: "",
    step: 0, business: { name: s.name, legal_name: "", address: s.address, unit: "", city: "", state: "", zip: "", business_email: "", phone: s.phone, website: s.website, first_name: s.contact_name, last_name: "", owner_mobile: "", owner_email: "", business_type: "Nail Salon", timezone: "America/Phoenix", hours: emptyHours(), legacy_hours: s.hours },
    services: services.map(x => ({ ...blankService(), ...x, id: x.id ?? crypto.randomUUID() })), team: [], solo: false, any_available: true,
    receptionist: { voice: ["mia", "linh", "ava", "sophie", "emma", "grace"].includes(s.voice) ? s.voice as SetupDraft["receptionist"]["voice"] : "mia", default_language: "English", languages: s.languages.filter(x => ["English", "Vietnamese", "Spanish", "Chinese", "Korean"].includes(x)) as SetupDraft["receptionist"]["languages"], auto_language: true, cancellation_policy: s.cancellation_policy, walk_ins: s.walk_ins, transfer_number: "", deposit_mode: "none", deposit_kind: "fixed", deposit_amount: 0 }, calendar: { requested: "" },
  };
}

export function hoursError(hours: DayHours[]): string | null {
  if (!hours.some(d => d.open)) return "Add at least one open day.";
  for (const [i, d] of hours.entries()) {
    if (d.open && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end) || d.start >= d.end)) return `Check ${days[i]}'s opening and closing times. Closing must be later on the same day.`;
  }
  return null;
}
export function stepError(step: number, d: SetupDraft): string | null {
  if (step === 0) {
    const b = d.business;
    if (!b.name.trim()) return "Enter the business name your customers know.";
    if (!b.address.trim() || !b.city.trim() || !b.state.trim() || !/^\d{5}(-\d{4})?$/.test(b.zip)) return "Add your business street address, city, state and ZIP.";
    if (!normalizeUsNumber(b.phone)) return "Enter your current US salon phone number.";
    if (!normalizeUsNumber(b.owner_mobile)) return "Enter your contact mobile number.";
    if (!b.first_name.trim() || !b.last_name.trim()) return "Add the contact person's first and last name.";
    if (![b.owner_email, b.business_email].every(x => z.email().safeParse(x).success)) return "Enter valid business and contact email addresses.";
    try { new Intl.DateTimeFormat("en", { timeZone: b.timezone }); } catch { return "Choose a valid time zone."; }
    if (b.website && !/^https?:\/\//.test(b.website)) return "Start the website address with https:// or http://.";
    return hoursError(b.hours);
  }
  if (step === 1) {
    if (!d.services.some(s => !s.is_addon)) return "Add at least one main service.";
    if (new Set(d.services.map(s => s.id)).size !== d.services.length) return "Services must have unique identifiers.";
    for (const s of d.services) {
      if (!s.name.trim() || s.minutes < 1) return "Give each service a name and duration.";
      if (s.price_mode === "range" && s.price_max < s.price) return `The upper price for ${s.name} must be at least its starting price.`;
      if (s.deposit_kind === "percent" && s.deposit_amount > 100) return `The deposit percentage for ${s.name} cannot exceed 100%.`;
      if (s.deposit_kind === "fixed" && s.deposit_amount > s.price) return `The deposit for ${s.name} cannot exceed its price.`;
      if (s.addon_ids.some(id => !d.services.some(a => a.id === id && a.is_addon && a.id !== s.id))) return `Review the add-ons for ${s.name}.`;
    }
  }
  if (step === 2) {
    if (!d.solo && !d.team.length) return "Add your team, or choose that you work on your own.";
    if (new Set(d.team.map(t => t.id)).size !== d.team.length) return "Team members must have unique identifiers.";
    for (const t of d.team) {
      if (!t.name.trim() || !t.role.trim() || !t.service_ids.length) return "Add a name, role and at least one service for each team member.";
      if (t.service_ids.some(id => !d.services.some(s => s.id === id))) return `Review services for ${t.name}.`;
      const error = hoursError(t.hours); if (error) return `${t.name}: ${error}`;
      if (t.image_url && !/^https:\/\//.test(t.image_url)) return "Profile images must use an HTTPS address.";
    }
  }
  if (step === 3) {
    if (!d.receptionist.languages.includes(d.receptionist.default_language)) return "Include your default language in the supported languages.";
    if (d.receptionist.transfer_number && !normalizeUsNumber(d.receptionist.transfer_number)) return "Enter a valid US transfer number.";
    if (d.receptionist.deposit_kind === "percent" && d.receptionist.deposit_amount > 100) return "The deposit percentage cannot exceed 100%.";
  }
  return null;
}

export function hoursText(d: SetupDraft): string {
  return `${days.map((day, i) => `${day}: ${d.business.hours[i]!.open ? `${d.business.hours[i]!.start}–${d.business.hours[i]!.end}` : "closed"}`).join("; ")} (${d.business.timezone})`;
}
