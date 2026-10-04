import {
  BarChart3, Bot, CalendarDays, CreditCard, LayoutDashboard, MessageSquare, Phone, PhoneCall, Plug, Scissors, Settings, Users, UserCog,
} from "lucide-react";

export const NAV = [
  { slug: "", label: "Overview", icon: LayoutDashboard },
  { slug: "calls", label: "Calls", icon: PhoneCall },
  { slug: "messages", label: "Messages", icon: MessageSquare },
  { slug: "appointments", label: "Appointments", icon: CalendarDays },
  { slug: "customers", label: "Customers", icon: Users },
  { slug: "agent", label: "Salon Agent", icon: Bot },
  { slug: "services", label: "Services & Menu", icon: Scissors },
  { slug: "phone-numbers", label: "Phone Numbers", icon: Phone },
  { slug: "team", label: "Team & Hours", icon: UserCog },
  { slug: "analytics", label: "Analytics", icon: BarChart3 },
  { slug: "integrations", label: "Integrations", icon: Plug },
  { slug: "settings", label: "Settings", icon: Settings },
  { slug: "billing", label: "Billing", icon: CreditCard },
] as const;

export const SECTION_COPY: Record<string, string> = {
  calls: "Every call your agent answers, with recordings, transcripts and outcomes.",
  messages: "Text conversations with your clients, handled by your agent.",
  appointments: "Bookings your agent made, synced with your calendar.",
  customers: "Everyone who called or texted, with their history.",
  agent: "Your agent's voice, greeting, knowledge and behavior.",
  services: "The services, prices and add-ons your agent quotes.",
  "phone-numbers": "Your salon numbers, forwarding and call routing.",
  team: "Who on your team can see and manage each location.",
  analytics: "Trends in calls, bookings and revenue captured.",
  integrations: "Calendar, booking app and other connections.",
  settings: "Business hours, notifications and preferences.",
  billing: "Your Salon Pro Agent plan, invoices and usage.",
};
