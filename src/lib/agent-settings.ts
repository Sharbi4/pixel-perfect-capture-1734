// Structured, owner-safe Salon Agent settings. Owners never edit the system prompt;
// each choice maps to fixed, vetted instruction text in agentBehavior().
import { z } from "zod";

export const LANGUAGES = [
  { code: "en", label: "English" }, { code: "es", label: "Spanish" }, { code: "vi", label: "Vietnamese" },
  { code: "ko", label: "Korean" }, { code: "zh", label: "Chinese" }, { code: "fr", label: "French" },
  { code: "pt", label: "Portuguese" }, { code: "ru", label: "Russian" },
] as const;
const codes = LANGUAGES.map((l) => l.code) as [string, ...string[]];
export const langLabel = (c: string) => LANGUAGES.find((l) => l.code === c)?.label ?? c;

export const OPTIONS = {
  style: { warm: "Warm & friendly", professional: "Polished & professional", upbeat: "Upbeat & energetic", concise: "Brief & efficient" },
  after_hours: { book: "Answer and book as usual", message: "Take a message for the team", callback: "Promise a callback next business day" },
  transfer: { never: "Never transfer — take a message", on_request: "Offer a callback when the caller asks for a person", upset: "Offer a callback if the caller asks or is upset" },
  callback: { offer: "Offer callbacks when it can't help", collect: "Always collect name, number and reason", never: "Don't promise callbacks" },
  booking: { full: "Book appointments", request: "Take booking requests only (team confirms)", none: "Don't book — share info only" },
  cancel: { allow: "Cancel appointments", request: "Take cancellation requests only", none: "Send cancellations to the team" },
  reschedule: { allow: "Reschedule appointments", request: "Take reschedule requests only", none: "Send reschedules to the team" },
  addons: { off: "Don't suggest add-ons", gentle: "Mention one relevant add-on", active: "Suggest add-ons when they fit" },
  deposit: { off: "Don't mention deposits", policy: "Mention the deposit policy when booking" },
  walkins: { policy: "Follow the salon's walk-in setting", welcome: "Walk-ins welcome — encourage booking to skip the wait", booking_only: "Appointments only — help them book" },
} as const;
type Opt<K extends keyof typeof OPTIONS> = keyof (typeof OPTIONS)[K];
const en = <K extends keyof typeof OPTIONS>(k: K) => z.enum(Object.keys(OPTIONS[k]) as [string, ...string[]]) as unknown as z.ZodType<Opt<K>>;

const clean = (max: number) => z.string().max(max).transform((s) => s.replace(/[\u0000-\u001f<>{}`]/g, " ").replace(/\s+/g, " ").trim());

export const AgentSettingsSchema = z.object({
  agent_name: clean(40).default(""),
  voice: z.string().max(20),
  style: en("style"),
  greeting: clean(240).default(""),
  default_language: z.enum(codes),
  extra_languages: z.array(z.enum(codes)).max(7),
  auto_switch: z.boolean(),
  interruptions: z.boolean(),
  after_hours: en("after_hours"),
  transfer: en("transfer"),
  callback: en("callback"),
  booking: en("booking"),
  cancel: en("cancel"),
  reschedule: en("reschedule"),
  addons: en("addons"),
  deposit: en("deposit"),
  sms_confirmations: z.boolean(),
  reminders: z.boolean(),
  walkins: en("walkins"),
});
export type AgentSettings = z.infer<typeof AgentSettingsSchema>;

export const DEFAULT_SETTINGS: AgentSettings = {
  agent_name: "", voice: "mia", style: "warm", greeting: "", default_language: "en", extra_languages: [], auto_switch: true,
  interruptions: true, after_hours: "book", transfer: "on_request", callback: "offer", booking: "full", cancel: "allow",
  reschedule: "allow", addons: "gentle", deposit: "policy", sms_confirmations: true, reminders: true, walkins: "policy",
};

/** Merge stored jsonb with defaults, dropping anything invalid. */
export function readSettings(raw: unknown, fallback: Partial<AgentSettings> = {}): AgentSettings {
  const base = { ...DEFAULT_SETTINGS, ...fallback, ...(raw && typeof raw === "object" ? raw : {}) };
  const r = AgentSettingsSchema.safeParse(base);
  return r.success ? r.data : { ...DEFAULT_SETTINGS, ...fallback };
}

export function defaultGreeting(salon: string, agent: string) {
  return `Thank you for calling ${salon || "the salon"}${agent ? `, this is ${agent}` : ""}. How can I help you today?`;
}

/** Tools the agent may use, given its permissions. */
export function allowedTools(s: AgentSettings): Set<string> {
  const t = new Set(["get_services", "get_staff", "check_availability", "add_to_waitlist", "find_my_appointments"]);
  if (s.booking === "full") t.add("book_appointment");
  if (s.cancel === "allow") t.add("cancel_appointment");
  if (s.reschedule === "allow") t.add("reschedule_appointment");
  if (s.booking === "none") t.delete("check_availability");
  return t;
}

const STYLE: Record<string, string> = {
  warm: "Sound warm, friendly and welcoming.", professional: "Sound polished, calm and professional.",
  upbeat: "Sound upbeat and energetic, but never pushy.", concise: "Be brief and efficient; keep every reply to one or two sentences.",
};

/** Fixed instruction text for each structured choice. */
export function agentBehavior(s: AgentSettings, walkInsWelcome: boolean): string {
  const langs = [s.default_language, ...s.extra_languages.filter((l) => l !== s.default_language)].map(langLabel);
  const L: string[] = [
    s.agent_name ? `Your name is ${s.agent_name}.` : "",
    STYLE[s.style] ?? "",
    `Speak ${langLabel(s.default_language)} by default.` + (langs.length > 1 ? ` You can also speak ${langs.slice(1).join(", ")}.` : ""),
    langs.length > 1 ? (s.auto_switch ? "If the caller speaks one of these languages, switch to it naturally." : `Stay in ${langLabel(s.default_language)} unless the caller asks to switch.`) : "",
    s.interruptions ? "If the caller interrupts, stop and listen." : "Finish your sentence before responding to the caller.",
    { book: "Outside business hours, help callers as usual.", message: "Outside business hours, explain the salon is closed and take a message (name, number, reason).", callback: "Outside business hours, explain the salon is closed and promise a callback the next business day." }[s.after_hours],
    { never: "You cannot transfer calls. If asked for a person, take a message.", on_request: "If the caller asks for a person, offer to have a team member call them back.", upset: "If the caller asks for a person or sounds upset, offer to have a team member call them back." }[s.transfer],
    { offer: "When you can't help, offer a callback.", collect: "For any callback, always collect the caller's name, number and reason.", never: "Do not promise callbacks; share the salon's phone and hours instead." }[s.callback],
    { full: "You may book appointments.", request: "Do not book directly. Take the caller's preferred service, day and time and say the team will confirm.", none: "Do not book appointments. Share information and suggest calling during business hours." }[s.booking],
    { allow: "You may cancel appointments after the caller confirms.", request: "Do not cancel directly; note the request and say the team will confirm.", none: "Do not cancel appointments; say a team member will follow up." }[s.cancel],
    { allow: "You may reschedule appointments to open times.", request: "Do not reschedule directly; note the request and say the team will confirm.", none: "Do not reschedule; say a team member will follow up." }[s.reschedule],
    { off: "Do not suggest add-ons.", gentle: "After choosing a service, you may mention one relevant add-on once.", active: "Suggest relevant add-ons from the menu when they fit, without pressure." }[s.addons],
    s.deposit === "policy" ? "When booking, mention the deposit policy if the salon has one." : "Do not bring up deposits unless asked.",
    s.sms_confirmations ? "After booking, say they'll get a text confirmation." : "Do not promise a text confirmation.",
    s.reminders ? "You can mention they'll get a reminder text before the visit." : "Do not promise reminder texts.",
    s.walkins === "welcome" || (s.walkins === "policy" && walkInsWelcome) ? "Walk-ins are welcome; suggest booking to skip the wait." : "The salon is appointment-only; help walk-in callers book instead.",
  ];
  return L.filter(Boolean).map((x) => `- ${x}`).join("\n");
}
