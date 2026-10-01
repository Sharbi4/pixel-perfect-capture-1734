// Edit plan details here — the pricing section renders from this config.
export const corePlan = {
  name: "NailDesk Pro",
  price: "$449",
  period: "/month",
  setupLabel: "Custom setup & launch",
  setupPrice: "$1,500",
  setupNote: "one-time",
  features: [
    "NailDesk dashboard",
    "AI text booking",
    "Appointment management",
    "SMS confirmations",
    "Custom salon setup",
    "Services & staff configuration",
    "Existing phone number connection",
    "English + Vietnamese",
    "Booking & calendar integration",
    "Launch support",
  ],
  cta: "Get NailDesk",
};

export const voiceAddon = {
  name: "AI Voice Receptionist",
  // Set to e.g. "+$199" when finalized; null shows "Pricing on request".
  price: null as string | null,
  period: "/month",
  description: "Let NailDesk answer your salon's calls, too — 24/7, in English and Vietnamese.",
  features: [
    "Answers every incoming call",
    "Books & reschedules appointments",
    "Service and pricing questions",
    "After-hours answering",
    "Smart transfers to staff",
    "SMS follow-up after calls",
  ],
  cta: "Add AI Receptionist",
};
