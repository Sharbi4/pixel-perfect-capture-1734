// One source for public pricing and server-validated checkout. Never accept prices from the browser.
export type Tier = "essential" | "pro" | "premier";
export type PricingPlan = {
  id: Tier;
  name: string;
  monthlyCents: number;
  price: string;
  period: string;
  blurb: string;
  highlight?: boolean;
  cta: string;
  minutes: number;
  sms: number;
  locations: number;
  numbers: number;
  users: number;
  features: string[];
};
export const setup = {
  label: "Custom Setup & Launch",
  price: "$199",
  cents: 19900,
  note: "one-time",
};
export const schedulingAddon = {
  name: "Salon Pro Scheduling",
  price: "$79",
  cents: 7900,
  period: "/month",
};
export const usageRates = { voiceCents: 35, smsCents: 4, locationCents: 24900 };
export const plans: PricingPlan[] = [
  {
    id: "essential",
    name: "Essential",
    monthlyCents: 29900,
    price: "$299",
    period: "/month",
    blurb: "A dependable front desk for your growing salon.",
    cta: "Choose Essential",
    minutes: 300,
    sms: 500,
    locations: 1,
    numbers: 1,
    users: 2,
    features: [
      "AI calls, booking & text replies",
      "Transcripts & call summaries",
      "Multilingual service knowledge",
      "Menu import & call transfers",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyCents: 44900,
    price: "$449",
    period: "/month",
    blurb: "More conversations. More control. Built for busy salons.",
    highlight: true,
    cta: "Choose Pro",
    minutes: 750,
    sms: 1500,
    locations: 1,
    numbers: 1,
    users: 5,
    features: [
      "Everything in Essential",
      "Salon Pro Scheduling included",
      "Deposit links & SMS automations",
      "Advanced routing & analytics",
      "Priority support",
    ],
  },
  {
    id: "premier",
    name: "Premier",
    monthlyCents: 69900,
    price: "$699",
    period: "/month",
    blurb: "One front desk experience across your locations.",
    cta: "Choose Premier",
    minutes: 1500,
    sms: 2500,
    locations: 2,
    numbers: 2,
    users: 10,
    features: [
      "Everything in Pro",
      "Two locations & phone numbers",
      "Multi-location reporting (planned)",
      "Location routing & team access",
      "Priority support",
    ],
  },
];
export function getPlan(id: unknown): PricingPlan {
  return plans.find((p) => p.id === id) ?? plans[1]!;
}
export function isTier(value: unknown): value is Tier {
  return plans.some((p) => p.id === value);
}
export const comparison: [string, boolean | string, boolean | string, boolean | string][] = [
  ["AI voice minutes / month", "300", "750", "1,500"],
  ["SMS segments / month", "500", "1,500", "2,500"],
  ["Salon locations", "1", "1", "2"],
  ["Phone numbers", "1", "1", "2"],
  ["Team users", "2", "5", "10"],
  ["AI calls & text-to-book", true, true, true],
  ["Transcripts & summaries", true, true, true],
  ["Multilingual receptionist", true, true, true],
  ["Menu import", true, true, true],
  ["Calendar connection eligibility", true, true, true],
  ["Salon Pro Scheduling", "+$79/mo", "Included", "Included"],
  ["Deposit links", false, true, true],
  ["Advanced routing & analytics", "—", "Rolling out", "Rolling out"],
  ["Custom SMS automations", "Limited", true, true],
  ["Multi-location reporting", false, false, true],
  ["Priority support", false, true, true],
];
export const defaultCta = "Get started";
// Brand/default plan compatibility for shared setup components.
export const plan = {
  ...getPlan("pro"),
  name: "Salon Pro Agent",
  setupCents: setup.cents,
  setupPrice: setup.price,
  currency: "USD",
};
