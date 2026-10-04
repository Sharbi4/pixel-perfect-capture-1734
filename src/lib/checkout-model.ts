import { z } from "zod";
export const previewKey = "salon-agent-ai:preview:v1";
export const previewSchema = z.object({
  tier: z.enum(["essential", "pro", "premier"]).default("pro"),
  phoneIntent: z.enum(["forward", "new", "port"]).default("forward"),
  calendarIntent: z.enum(["square", "google", "salon_pro", "other", "unsure"]).default("unsure"),
  addonInterests: z.array(z.enum(["scheduling", "extra_location"])).max(2).default([]),
  name: z.string().trim().min(1).max(120),
  businessType: z.string().max(80),
  website: z.string().max(500),
  services: z.string().max(6000),
  voice: z.enum(["mia", "sophie", "emma", "linh", "ava", "grace"]),
  step: z.number().int().min(0).max(2),
});
export type PreviewDraft = z.infer<typeof previewSchema>;
export const buyerSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((x) => x.trim().toLowerCase()),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
});
export type Buyer = z.infer<typeof buyerSchema>;
export type CheckoutStatus = {
  tier: "essential" | "pro" | "premier";
  monthlyCents: number;
  totalCents: number;
  state: "draft" | "processing" | "paid" | "needs_review" | "refunded";
  hasPayment: boolean;
  email: string;
  nextBillingDate: string;
  error: string;
  canResume: boolean;
};
export function nextMonth(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw Error("Invalid date");
  const next = new Date(Date.UTC(y, m, 1)),
    last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(d, last));
  return next.toISOString().slice(0, 10);
}
export function localDate(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Convert a calendar boundary using the location's offset, including DST. */
export function zonedMidnight(date: string, timezone: string) {
  const target = Date.parse(`${date}T00:00:00Z`);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(instant));
    const n = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    const shown = Date.UTC(
      n("year"),
      n("month") - 1,
      n("day"),
      n("hour"),
      n("minute"),
      n("second"),
    );
    const delta = target - shown;
    if (!delta) return new Date(instant).toISOString();
    instant += delta;
  }
  throw Error("billing_date_unavailable");
}
export function nextDay(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
