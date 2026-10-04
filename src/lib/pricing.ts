// Edit plan details here — the pricing section and setup paywall render from this config.
export type Tier = "essential" | "pro" | "premier";

export const setup = { label: "Custom setup & launch", price: "$1,500", note: "one-time" };
export const schedulingAddon = { name: "Salon Pro Scheduling", price: "$79", period: "/month" };

export const plans: { id: Tier; name: string; price: string; period: string; blurb: string; highlight?: boolean; cta: string }[] = [
  { id: "essential", name: "Essential", price: "$299", period: "/month", blurb: "Your AI phone receptionist, connected to your existing calendar.", cta: "Start with Essential" },
  { id: "pro", name: "Pro", price: "$449", period: "/month", blurb: "Receptionist plus Salon Pro Scheduling, waitlist, reminders and deposits.", highlight: true, cta: "Get Pro" },
  { id: "premier", name: "Premier", price: "$699", period: "/month", blurb: "Everything in Pro, for salons with multiple locations.", cta: "Get Premier" },
];

// Feature comparison. true = included, false = not available, string = note (e.g. "Add-on").
export const comparison: [string, boolean | string, boolean | string, boolean | string][] = [
  ["AI phone receptionist, 24/7", true, true, true],
  ["AI text booking & replies", true, true, true],
  ["External calendar integration", true, true, true],
  ["Calendar view in Salon Pro", true, true, true],
  ["AI booking", true, true, true],
  ["SMS confirmations", true, true, true],
  ["Email confirmations", true, true, true],
  ["Salon Pro Scheduling", "+$79/mo", "Included", "Included"],
  ["Staff scheduling", "Add-on", true, true],
  ["Waitlist", "Add-on", true, true],
  ["Automated reminders", "Add-on", true, true],
  ["Deposits", false, true, true],
  ["Online booking page", "Add-on", true, true],
  ["Multi-location scheduling", false, false, true],
];

export const defaultCta = "Get Salon Pro Agent";
