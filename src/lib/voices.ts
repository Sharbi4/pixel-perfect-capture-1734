export const voices = [
  { id: "mia", name: "Mia", vibe: "Warm & professional", engine: "Sulafat" },
  { id: "sophie", name: "Sophie", vibe: "Friendly & upbeat", engine: "Zephyr" },
  { id: "emma", name: "Emma", vibe: "Calm & polished", engine: "Despina" },
  { id: "linh", name: "Linh", vibe: "Bilingual English / Vietnamese", engine: "Kore" },
  { id: "ava", name: "Ava", vibe: "Modern & energetic", engine: "Leda" },
  { id: "grace", name: "Grace", vibe: "Gentle & reassuring", engine: "Vindemiatrix" },
] as const;

export type VoiceId = (typeof voices)[number]["id"];

export const starterServices = [
  { name: "Gel Manicure", price: 45, minutes: 45, is_addon: false },
  { name: "Classic Pedicure", price: 40, minutes: 45, is_addon: false },
  { name: "Acrylic Full Set", price: 60, minutes: 75, is_addon: false },
  { name: "French Add-On", price: 10, minutes: 10, is_addon: true },
  { name: "Gel Removal", price: 12, minutes: 15, is_addon: true },
];

export function greeting(salon: string) {
  return `Thank you for calling ${salon || "your salon"}. How can I help you today?`;
}
