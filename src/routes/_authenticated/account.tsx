import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock, Loader2 } from "lucide-react";
import { loadOrCreateSalon, type Salon } from "@/lib/salon-data";
import { voices } from "@/lib/voices";
import { useServerFn } from "@tanstack/react-start";
import { launchSalon } from "@/lib/setup.functions";
import { TestCall } from "@/components/nd/TestCall";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My salon status — NailDesk Pro" },
      { name: "description", content: "Track your NailDesk Pro receptionist, phone number and texting setup." },
      { property: "og:title", content: "My salon status — NailDesk Pro" },
      { property: "og:description", content: "See where your AI receptionist setup stands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const [salon, setSalon] = useState<Salon | null>(null);
  const [count, setCount] = useState(0);
  const launch = useServerFn(launchSalon);
  const [building, setBuilding] = useState(false);
  async function rebuild() { setBuilding(true); await launch(); const r = await loadOrCreateSalon(); setSalon(r.salon); setBuilding(false); }
  useEffect(() => { loadOrCreateSalon().then((r) => { setSalon(r.salon); setCount(r.services.length); }); }, []);
  if (!salon) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></div>;

  const launched = salon.status !== "draft";
  const voice = voices.find((v) => v.id === salon.voice);
  const items: [string, string, "done" | "wait" | "todo"][] = [
    ["Salon details", salon.name || "Not added yet", salon.name ? "done" : "todo"],
    ["Services", `${count} services`, count ? "done" : "todo"],
    ["Receptionist voice", voice?.name ?? "—", "done"],
    ["Receptionist built", salon.agent_id ? "Ready — try a test call below" : salon.agent_error || (launched ? "Building…" : "Launch from setup to start"), salon.agent_id ? "done" : launched ? "wait" : "todo"],
    ["Phone number", launched ? "Being set up — we'll email you" : "After launch", launched ? "wait" : "todo"],
    ["Texting", "Pending business texting approval (usually a few days)", launched ? "wait" : "todo"],
  ];
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="font-semibold tracking-tight">NailDesk Pro</Link>
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">{salon.name || "Your salon"}</h1>
        <p className="mt-2 text-muted-foreground">{launched ? "You're launched! Calls go live first; texting follows once approved." : "Finish setup to launch your receptionist."}</p>
        <ul className="glass mt-8 divide-y divide-border rounded-[28px]">
          {items.map(([t, d, s]) => (
            <li key={t} className="flex items-center gap-4 p-5">
              <span className="grid size-8 place-items-center rounded-full bg-accent">
                {s === "done" ? <Check className="size-4 text-success" /> : s === "wait" ? <Clock className="size-4" /> : <span className="size-2 rounded-full bg-muted-foreground" />}
              </span>
              <div><div className="font-medium">{t}</div><div className="text-sm text-muted-foreground">{d}</div></div>
            </li>
          ))}
        </ul>
        {salon.agent_id && <TestCall />}
        {launched && (
          <button onClick={rebuild} disabled={building} className="mt-6 mr-3 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium">{building ? "Updating…" : salon.agent_id ? "Update receptionist with latest info" : "Try building again"}</button>
        )}
        <Link to="/setup" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">{launched ? "Edit setup" : "Continue setup"}</Link>
      </div>
    </div>
  );
}
