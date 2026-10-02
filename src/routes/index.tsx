import { LiveAgent } from "@/components/nd/LiveAgent";
import { createFileRoute } from "@tanstack/react-router";
import {
  Channels, DashboardSection, FinalCta, Footer, Hero, HowItWorks, Nav, Pricing, SetupFlow, TextToBook, Value, VoiceUpsell,
} from "@/components/nd/Sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Salon Pro Agent — AI Receptionist & Answering Service for Salons" },
      { name: "description", content: "Salon Pro Agent is the AI receptionist for salons: a 24/7 salon answering service that answers every call, texts clients and books appointments. English + Vietnamese." },
      { property: "og:title", content: "Salon Pro Agent — AI Receptionist & Answering Service for Salons" },
      { property: "og:description", content: "The AI receptionist for salons: answers every call, texts clients and books appointments 24/7." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="overflow-x-clip">
      <Nav />
      <main>
        <Hero />
        <LiveAgent />
        <TextToBook />
        <Channels />
        <VoiceUpsell />
        <Value />
        <DashboardSection />
        <HowItWorks />
        <SetupFlow />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
