import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, MessageSquare, PhoneCall, TrendingUp } from "lucide-react";
import { BrandMark } from "@/components/brand/Brand";
import { loadPhoneSetup } from "@/lib/salon-data";
import { formatUsNumber } from "@/lib/phone-format";
import type { PhoneSetup } from "@/lib/phone-status";
import { useActiveLocation as useLocation } from "@/components/dashboard/location-context";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Overview — Salon Pro Agent" }, { name: "description", content: "What your AI receptionist is doing for your salon." }, { property: "og:title", content: "Overview — Salon Pro Agent" }, { property: "og:description", content: "What your AI receptionist is doing for your salon." }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

// No call/text/booking history is stored yet, so these read zero until activity arrives.
const KPIS = [
  { label: "Calls answered", icon: PhoneCall },
  { label: "Appointments booked", icon: CalendarDays },
  { label: "Texts handled", icon: MessageSquare },
  { label: "Est. revenue captured", icon: TrendingUp, money: true },
];

function Overview() {
  const { location } = useLocation();
  const [setup, setSetup] = useState<PhoneSetup | null>(null);
  useEffect(() => { setSetup(null); void loadPhoneSetup(location.id).then(setSetup).catch(() => {}); }, [location.id]);

  const live = location.has_receptionist && !!location.phone_number;
  const status = location.has_receptionist
    ? live ? { t: "Live", d: "Answering calls", c: "bg-success" } : { t: "Ready", d: "Waiting for a phone number", c: "bg-coral" }
    : { t: "Not built yet", d: "Finish setup to build your agent", c: "bg-muted-foreground" };

  const checks = [
    ["Receptionist built", location.has_receptionist],
    ["Phone number set up", !!location.phone_number],
    ["Test call confirmed", setup?.voice_status === "verified"],
    ["Call forwarding confirmed", setup?.forwarding_status === "verified"],
    ["Texting approved", setup?.texting_status === "approved"],
  ] as const;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Overview</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{location.name || "Your salon"}</h1>
        </div>
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
          <span className={`size-2 rounded-full ${status.c} ${live ? "pulse-ring" : ""}`} />{status.t}<span className="text-muted-foreground">· {status.d}</span>
        </span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map(({ label, icon: I, money }) => (
          <div key={label} className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs sm:text-sm">{label}</span><I className="size-4" /></div>
            <div className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{money ? "$0" : "0"}</div>
            <div className="mt-1 text-xs text-muted-foreground">This month</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="glass rounded-[28px] p-6">
          <h2 className="font-medium">Recent activity</h2>
          <div className="grid place-items-center py-14 text-center">
            <BrandMark className="size-12 opacity-80" />
            <p className="mt-4 font-medium">No calls or texts yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">{live ? "When clients call or text, you'll see each conversation here." : "Once your agent is live, every conversation shows up here."}</p>
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <h2 className="font-medium">Your agent</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Agent number</dt><dd>{location.phone_number ? formatUsNumber(location.phone_number) : "Not set up"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Your access</dt><dd className="capitalize">{location.role}</dd></div>
          </dl>
          <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
            {checks.map(([t, ok]) => (
              <li key={t} className="flex items-center gap-3 text-sm">
                <span className={`size-2 rounded-full ${ok ? "bg-success" : "bg-surface-2"}`} />
                <span className={ok ? "" : "text-muted-foreground"}>{t}</span>
              </li>
            ))}
          </ul>
          <Link to="/account" className="mt-6 inline-flex items-center gap-1.5 text-sm text-violet hover:underline">Full setup status <ArrowRight className="size-3.5" /></Link>
        </section>
      </div>
    </div>
  );
}
