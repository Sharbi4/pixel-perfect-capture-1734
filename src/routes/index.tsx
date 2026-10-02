import { LiveAgent } from "@/components/nd/LiveAgent";
import { createFileRoute } from "@tanstack/react-router";
import {
  Channels, DashboardSection, FinalCta, Footer, Hero, HowItWorks, Nav, Pricing, SetupFlow, TextToBook, Value, VoiceUpsell,
} from "@/components/nd/Sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NailDesk AI — The AI front desk for nail salons" },
      { name: "description", content: "AI-powered calls, texts and appointment booking built for nail salons. English + Vietnamese." },
      { property: "og:title", content: "NailDesk AI — The AI front desk for nail salons" },
      { property: "og:description", content: "NailDesk answers customers, books appointments and keeps your calendar moving." },
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
