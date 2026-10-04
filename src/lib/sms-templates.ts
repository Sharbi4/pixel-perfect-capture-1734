// Text automations: defaults, editable wording and the compliance lines owners can't remove.
export type SmsKind =
  | "appointment_confirmation" | "appointment_reminder" | "missed_call" | "deposit_reminder" | "booking_link"
  | "cancellation_confirmation" | "reschedule_confirmation" | "address" | "after_hours" | "callback_confirmation"
  | "review_request" | "marketing";

export type SmsTemplate = {
  kind: SmsKind; label: string; help: string; body: string; defaultOn: boolean;
  /** Sent automatically today. False = setting saves now, sending switches on when that trigger ships. */
  live: boolean;
  /** Appended unless already present; owners can't edit it out. */
  required: string; marketing?: boolean;
};

const OPT = "Reply STOP to opt out.";

export const SMS_TEMPLATES: SmsTemplate[] = [
  { kind: "appointment_confirmation", label: "Appointment confirmations", help: "Sent when your Salon Agent books on a call.", body: "{salon}: you're booked for {service} with {tech} on {when}. {address} Reply to this text to make changes.", defaultOn: true, live: true, required: "" },
  { kind: "reschedule_confirmation", label: "Reschedule confirmations", help: "Sent when an appointment moves to a new time.", body: "{salon}: you're rescheduled for {service} with {tech} on {when}. Reply to this text to make changes.", defaultOn: true, live: true, required: "" },
  { kind: "cancellation_confirmation", label: "Cancellation confirmations", help: "Sent when a client cancels through your Salon Agent.", body: "{salon}: your {service} on {when} is cancelled. Reply to book a new time.", defaultOn: true, live: true, required: "" },
  { kind: "appointment_reminder", label: "Appointment reminders", help: "Sent the day before an appointment.", body: "{salon}: reminder of your {service} on {when}. Reply C to confirm or R to reschedule.", defaultOn: true, live: false, required: OPT },
  { kind: "missed_call", label: "Missed call follow-up", help: "Sent when a call ends before the client was helped.", body: "{salon}: sorry we missed you! Reply here and we'll help you book.", defaultOn: false, live: false, required: OPT },
  { kind: "deposit_reminder", label: "Deposit reminders", help: "Sent when a booking still needs its deposit.", body: "{salon}: please pay your deposit to hold your {service} on {when}: {link}", defaultOn: false, live: false, required: "" },
  { kind: "booking_link", label: "Booking links", help: "Sent when a client asks to book online.", body: "{salon}: book your next visit here: {link}", defaultOn: false, live: false, required: "" },
  { kind: "address", label: "Address & directions", help: "Sent when a caller asks where you are.", body: "{salon} is at {address}. See you soon!", defaultOn: true, live: false, required: "" },
  { kind: "after_hours", label: "After-hours texts", help: "Sent to callers outside your business hours.", body: "{salon}: we're closed right now. Reply here and we'll get back to you when we open.", defaultOn: false, live: false, required: OPT },
  { kind: "callback_confirmation", label: "Callback confirmations", help: "Sent when your Salon Agent promises a callback.", body: "{salon}: thanks for calling! A team member will call you back soon.", defaultOn: true, live: false, required: "" },
  { kind: "review_request", label: "Review requests", help: "Sent after a completed appointment.", body: "{salon}: thanks for visiting! Mind leaving us a quick review? {link}", defaultOn: false, live: false, required: OPT },
  { kind: "marketing", label: "Marketing messages", help: "Promotions and offers. Only sent to clients who agreed to receive them.", body: "{salon}: {offer}", defaultOn: false, live: false, required: `Msg & data rates may apply. ${OPT}`, marketing: true },
];

export const tpl = (k: SmsKind) => SMS_TEMPLATES.find((t) => t.kind === k)!;

/** Fill placeholders, prefix the salon name if missing, and enforce the required compliance line. */
export function renderSms(k: SmsKind, custom: string | null | undefined, vars: Record<string, string>) {
  const t = tpl(k);
  let s = (custom?.trim() || t.body).replace(/\{(\w+)\}/g, (_, v: string) => vars[v] ?? "").replace(/\s+/g, " ").trim();
  if (vars["salon"] && !s.includes(vars["salon"])) s = `${vars["salon"]}: ${s}`;
  if (t.required && !s.toLowerCase().includes("stop")) s = `${s} ${t.required}`;
  return s;
}
