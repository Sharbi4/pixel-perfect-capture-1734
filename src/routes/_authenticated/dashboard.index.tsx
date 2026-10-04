import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, MessageSquare, PhoneCall, TrendingUp } from "lucide-react";
import { loadPhoneSetup } from "@/lib/salon-data";
import { supabase } from "@/integrations/supabase/client";
import { formatUsNumber } from "@/lib/phone-format";
import type { PhoneSetup } from "@/lib/phone-status";
import { addDays, fmtTime, localDate, zoned } from "@/lib/availability";
import { useActiveLocation as useLocation } from "@/components/dashboard/location-context";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Overview — Salon Pro Agent" }, { name: "description", content: "What your AI receptionist is doing for your salon." }, { property: "og:title", content: "Overview — Salon Pro Agent" }, { property: "og:description", content: "What your AI receptionist is doing for your salon." }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

// Calls, texts, bookings and revenue all count real saved activity.
const KPIS = [
  { label: "Calls answered", icon: PhoneCall },
  { label: "Appointments booked", icon: CalendarDays },
  { label: "Texts handled", icon: MessageSquare },
  { label: "Est. revenue captured", icon: TrendingUp, money: true },
];

const RANGES = [
  { k: "today", label: "Today" },
  { k: "7", label: "7 days" },
  { k: "30", label: "30 days" },
  { k: "custom", label: "Custom" },
] as const;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Overview() {
  const { location } = useLocation();
  const [setup, setSetup] = useState<PhoneSetup | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [range, setRange] = useState<string>("30");
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 29 * 864e5)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const today = dayStart(new Date());
  const [since, until] = range === "custom"
    ? [new Date(`${from}T00:00:00`), new Date(new Date(`${to}T00:00:00`).getTime() + 864e5)]
    : [range === "today" ? today : new Date(today.getTime() - (Number(range) - 1) * 864e5), new Date(today.getTime() + 864e5)];
  const periodLabel = range === "today" ? "Today" : range === "custom" ? "Selected dates" : `Last ${range} days`;
  const s = since.toISOString(), u = until.toISOString();
  useEffect(() => {
    if (Number.isNaN(Date.parse(s)) || Number.isNaN(Date.parse(u))) return;
    void Promise.all([
      supabase.from("calls").select("id", { count: "exact", head: true }).eq("salon_id", location.id).gte("started_at", s).lt("started_at", u),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("salon_id", location.id).gte("sent_at", s).lt("sent_at", u),
      supabase.from("appointments").select("price,source,status").eq("salon_id", location.id).gte("created_at", s).lt("created_at", u).neq("status", "cancelled"),
    ]).then(([c, m, a]) => {
      const ai = (a.data ?? []).filter((x) => x.source !== "staff");
      setCounts({ "Calls answered": c.count ?? 0, "Texts handled": m.count ?? 0, "Appointments booked": (a.data ?? []).length, revenue: ai.reduce((t, x) => t + Number(x.price), 0) });
    });
  }, [location.id, s, u]);
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

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r.k} onClick={() => setRange(r.k)} className={`rounded-full px-4 py-1.5 text-sm ${range === r.k ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"}`}>{r.label}</button>
        ))}
        {range === "custom" && (
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm">
            <input type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="bg-transparent outline-none" />
            <span className="text-muted-foreground">to</span>
            <input type="date" aria-label="To" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="bg-transparent outline-none" />
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map(({ label, icon: I, money }) => (
          <div key={label} className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs sm:text-sm">{label}</span><I className="size-4" /></div>
            <div className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{money ? `$${Math.round(counts["revenue"] ?? 0).toLocaleString()}` : (counts[label] ?? 0)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{periodLabel}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <TodayCard salonId={location.id} />

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

function TodayCard({ salonId }: { salonId: string }) {
  const [rows, setRows] = useState<{ id: string; client_name: string; service_name: string; starts_at: string; source: string; status: string; staff: { name: string } | null }[] | null>(null);
  const [tz, setTz] = useState("America/Phoenix");
  useEffect(() => {
    void (async () => {
      const { data: s } = await supabase.from("salons").select("timezone").eq("id", salonId).single();
      const zone = s?.timezone ?? "America/Phoenix"; setTz(zone);
      const day = localDate(new Date(), zone);
      const { data } = await supabase.from("appointments").select("id,client_name,service_name,starts_at,source,status,staff:staff(name)").eq("salon_id", salonId)
        .gte("starts_at", zoned(day, 0, zone).toISOString()).lt("starts_at", zoned(addDays(day, 1), 0, zone).toISOString()).neq("status", "cancelled").order("starts_at");
      setRows((data ?? []) as never);
    })();
  }, [salonId]);
  return (
    <section className="glass rounded-[28px] p-6">
      <div className="flex items-center justify-between"><h2 className="font-medium">Today's appointments</h2>
        <Link to="/dashboard/appointments" className="inline-flex items-center gap-1 text-sm text-violet hover:underline">View calendar <ArrowRight className="size-3.5" /></Link></div>
      {!rows ? <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p> : !rows.length ? (
        <div className="grid place-items-center py-12 text-center"><CalendarDays className="size-8 text-muted-foreground" /><p className="mt-3 font-medium">Nothing booked today</p><p className="mt-1 text-sm text-muted-foreground">New bookings from your Salon Agent show up here.</p></div>
      ) : (
        <ul className="mt-4 divide-y divide-border">{rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
            <span className="w-16 font-mono text-xs text-muted-foreground">{fmtTime(r.starts_at, tz)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.client_name || "Client"}</span><span className="block truncate text-xs text-muted-foreground">{r.service_name} · {r.staff?.name ?? "Any"}</span></span>
            {r.source !== "staff" && <span className="rounded-full bg-violet/20 px-2 py-0.5 text-[11px] text-violet">AI Booked</span>}
          </li>))}</ul>
      )}
    </section>
  );
}
