import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { DAYS, hhmm, loadBasics, parseHHMM, type SalonRules, type Service, type Staff } from "@/lib/appointments";
import type { Hours } from "@/lib/availability";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/team")({
  head: () => ({ meta: [{ title: "Team & hours — Salon Pro Agent" }, { name: "description", content: "Your technicians, their services and working hours." }, { property: "og:title", content: "Team & hours — Salon Pro Agent" }, { property: "og:description", content: "Technicians, services and working hours." }, { name: "robots", content: "noindex" }] }),
  component: TeamPage,
});

const TZS = ["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu"];
const field = "h-9 rounded-xl bg-accent px-3 text-sm outline-none";

function TeamPage() {
  const { location } = useActiveLocation();
  const [data, setData] = useState<{ rules: SalonRules; staff: Staff[]; services: Service[] } | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => setData(await loadBasics(location.id)), [location.id]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const n = name.trim(); if (!n) return;
    const { error } = await supabase.from("staff").insert({ salon_id: location.id, name: n.slice(0, 60), position: data?.staff.length ?? 0 });
    if (error) return setErr("Couldn't add that person.");
    setName(""); void load();
  };
  const saveStaff = async (id: string, p: Partial<Staff>) => {
    setData((d) => d && { ...d, staff: d.staff.map((s) => (s.id === id ? { ...s, ...p } : s)) });
    const { error } = await supabase.from("staff").update(p as never).eq("id", id);
    if (error) { setErr("Couldn't save that change."); void load(); }
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("staff").update({ active: false }).eq("id", id);
    if (error) setErr("Couldn't remove."); else void load();
  };
  const saveRules = async (p: Partial<SalonRules>) => {
    setData((d) => d && { ...d, rules: { ...d.rules, ...p } });
    const { error } = await supabase.from("salons").update(p as never).eq("id", location.id);
    if (error) setErr("Couldn't save booking rules.");
  };

  if (!data) return <div className="grid place-items-center py-24"><Loader2 className="size-5 animate-spin" /></div>;
  const active = data.staff.filter((s) => s.active);
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-muted-foreground">{location.name || "Your salon"}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Team & hours</h1>
      <p className="mt-2 text-muted-foreground">Your Salon Agent only offers times when a technician who does that service is working.</p>
      {err && <p className="mt-4 text-sm text-coral">{err}</p>}

      <section className="glass mt-6 rounded-[28px] p-6">
        <h2 className="font-medium">Booking rules</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm"><span className="block text-xs text-muted-foreground">Time zone</span>
            <select value={data.rules.timezone} onChange={(e) => saveRules({ timezone: e.target.value })} className={cn(field, "mt-1 w-full")}>{TZS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <Num label="Cleanup buffer (min)" v={data.rules.buffer_min} max={120} on={(n) => saveRules({ buffer_min: n })} />
          <Num label="Minimum notice (min)" v={data.rules.lead_min} max={10080} on={(n) => saveRules({ lead_min: n })} />
          <Num label="Book up to (days ahead)" v={data.rules.horizon_days} min={1} max={365} on={(n) => saveRules({ horizon_days: n })} />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={data.rules.confirm_texts} onChange={(e) => saveRules({ confirm_texts: e.target.checked })} /> Text clients a confirmation when the Salon Agent books on a call</label>
      </section>

      <section className="mt-4 space-y-4">
        {active.map((s) => <StaffCard key={s.id} s={s} services={data.services} onSave={(p) => saveStaff(s.id, p)} onRemove={() => remove(s.id)} />)}
        <div className="glass flex gap-2 rounded-3xl p-4">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Technician name, e.g. Mia" className={cn(field, "flex-1")} />
          <button onClick={add} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm text-primary-foreground"><Plus className="size-4" />Add technician</button>
        </div>
      </section>
    </div>
  );
}

function Num({ label, v, on, min = 0, max }: { label: string; v: number; on: (n: number) => void; min?: number; max: number }) {
  const [x, setX] = useState(String(v));
  return <label className="text-sm"><span className="block text-xs text-muted-foreground">{label}</span>
    <input type="number" min={min} max={max} value={x} onChange={(e) => setX(e.target.value)} onBlur={() => { const n = Math.min(max, Math.max(min, Math.round(Number(x) || 0))); setX(String(n)); if (n !== v) on(n); }} className={cn(field, "mt-1 w-full")} /></label>;
}

function StaffCard({ s, services, onSave, onRemove }: { s: Staff; services: Service[]; onSave: (p: Partial<Staff>) => void; onRemove: () => void }) {
  const [name, setName] = useState(s.name);
  const setDay = (d: number, r: [number, number][]) => { const h: Hours = { ...s.hours, [String(d)]: r }; if (!r.length) delete h[String(d)]; onSave({ hours: h }); };
  const toggleSvc = (id: string) => onSave({ service_ids: s.service_ids.includes(id) ? s.service_ids.filter((x) => x !== id) : [...s.service_ids, id] });
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== s.name && onSave({ name: name.trim().slice(0, 60) })} className="flex-1 bg-transparent text-lg font-medium outline-none" aria-label="Name" />
        <button onClick={onRemove} aria-label={`Remove ${s.name}`} className="text-muted-foreground hover:text-coral"><Trash2 className="size-4" /></button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {DAYS.map((d, i) => {
          const r = s.hours[String(i)]?.[0];
          return (
            <div key={d} className="flex items-center gap-2 text-sm">
              <label className="flex w-16 items-center gap-1.5"><input type="checkbox" checked={!!r} onChange={(e) => setDay(i, e.target.checked ? [[540, 1080]] : [])} />{d}</label>
              {r ? <>
                <input type="time" value={hhmm(r[0])} onChange={(e) => setDay(i, [[parseHHMM(e.target.value), r[1]]])} className={field} aria-label={`${d} start`} />
                <span className="text-muted-foreground">to</span>
                <input type="time" value={hhmm(r[1])} onChange={(e) => setDay(i, [[r[0], parseHHMM(e.target.value)]])} className={field} aria-label={`${d} end`} />
              </> : <span className="text-muted-foreground">Off</span>}
            </div>
          );
        })}
      </div>
      {services.length > 0 && <div className="mt-4">
        <span className="text-xs text-muted-foreground">Services {s.service_ids.length ? "" : "(none picked = does everything)"}</span>
        <div className="mt-2 flex flex-wrap gap-1.5">{services.map((v) => (
          <button key={v.id} onClick={() => toggleSvc(v.id)} className={cn("rounded-full px-3 py-1 text-xs", s.service_ids.includes(v.id) ? "bg-violet/25 text-foreground" : "bg-accent text-muted-foreground")}>{v.name}</button>))}</div>
      </div>}
    </div>
  );
}
