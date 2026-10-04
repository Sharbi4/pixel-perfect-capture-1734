import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Pause, Phone, Play, RefreshCw, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { TestCall } from "@/components/nd/TestCall";
import { GoogleCalendarConnect } from "@/components/dashboard/GoogleCalendarConnect";
import { KnowledgeEditor } from "@/components/dashboard/KnowledgeEditor";
import { BrandMark } from "@/components/brand/Brand";
import { voices } from "@/lib/voices";
import { formatUsNumber } from "@/lib/phone-format";
import { PROVIDER } from "@/lib/appointments";
import { LANGUAGES, OPTIONS, defaultGreeting, langLabel, readSettings, type AgentSettings } from "@/lib/agent-settings";
import { saveAgentSettings } from "@/lib/agent-settings.functions";
import { syncAgent } from "@/lib/agent-sync.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/agent")({
  head: () => ({ meta: [{ title: "Your Salon Agent — Salon Pro Agent" }, { name: "description", content: "Status, voice and behavior settings for your salon's AI receptionist." }, { property: "og:title", content: "Your Salon Agent — Salon Pro Agent" }, { property: "og:description", content: "Manage your AI receptionist's voice, languages and permissions." }, { name: "robots", content: "noindex" }] }),
  component: AgentPage,
});

type Info = { name: string; hours: string; walk_ins: boolean; booking_provider: string; agent_sync_status: string; last_synced_at: string | null; has_receptionist: boolean; phone_number: string; services: number; staff: number; forwarding: string };

function ago(iso: string | null) {
  if (!iso) return "never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function AgentPage() {
  const { location } = useActiveLocation();
  const canEdit = location.role !== "staff";
  const save = useServerFn(saveAgentSettings);
  const sync = useServerFn(syncAgent);
  const [info, setInfo] = useState<Info | null>(null);
  const [saved, setSaved] = useState<AgentSettings | null>(null);
  const [s, setS] = useState<AgentSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    const [a, sv, st, ps] = await Promise.all([
      supabase.from("salons").select("name,hours,walk_ins,voice,booking_provider,agent_sync_status,last_synced_at,has_receptionist,phone_number,agent_settings").eq("id", location.id).single(),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", location.id).eq("archived", false),
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", location.id).eq("active", true),
      supabase.from("phone_setups").select("forwarding_status").eq("salon_id", location.id).maybeSingle(),
    ]);
    if (!a.data) return;
    const d = a.data;
    setInfo({ name: d.name, hours: d.hours, walk_ins: d.walk_ins, booking_provider: d.booking_provider, agent_sync_status: d.agent_sync_status, last_synced_at: d.last_synced_at, has_receptionist: !!d.has_receptionist, phone_number: d.phone_number, services: sv.count ?? 0, staff: st.count ?? 0, forwarding: ps.data?.forwarding_status ?? "" });
    const set = readSettings(d.agent_settings, { voice: d.voice });
    setSaved(set); setS((cur) => cur ?? set);
  }, [location.id]);
  useEffect(() => { setS(null); setInfo(null); void load(); }, [load]);

  const dirty = !!s && !!saved && JSON.stringify(s) !== JSON.stringify(saved);
  const up = (p: Partial<AgentSettings>) => setS((x) => (x ? { ...x, ...p } : x));

  const onSave = async () => {
    if (!s) return; setBusy(true); setMsg(null);
    try {
      const r = await save({ data: { salonId: location.id, settings: s } });
      setSaved(s);
      setMsg(r.sync === "synced" ? { ok: true, t: "Saved and sent to your Salon Agent." } : r.sync === "no_agent" ? { ok: true, t: "Saved. Your Salon Agent will use these settings once it's built." } : { ok: false, t: "Saved, but we couldn't update your Salon Agent yet. Try “Update now”." });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    await load(); setBusy(false);
  };
  const onSync = async () => {
    setBusy(true); setMsg(null);
    try { const r = await sync({ data: { salonId: location.id } }); if (r.result === "failed") setMsg({ ok: false, t: "We couldn't reach your Salon Agent. Please try again shortly." }); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    await load(); setBusy(false);
  };

  if (!info || !s) return <div className="grid place-items-center py-24"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  const voice = voices.find((v) => v.id === saved!.voice) ?? voices[0];
  const langs = [saved!.default_language, ...saved!.extra_languages].map(langLabel);
  const status = !info.has_receptionist ? { t: "Not built yet", c: "bg-accent text-muted-foreground" } : { t: "Active", c: "bg-success/15 text-success" };
  const upToDate = info.has_receptionist && info.agent_sync_status === "synced";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-4">
        <BrandMark className="size-12" />
        <div className="flex-1"><h1 className="text-3xl font-semibold tracking-tight">Your Salon Agent</h1><p className="mt-1 text-muted-foreground">{saved!.agent_name || voice.name} answers calls for {info.name || "your salon"}.</p></div>
        <span className={cn("rounded-full px-3 py-1 text-sm font-medium", status.c)}>Agent status: {status.t}</span>
      </div>

      <SyncBar info={info} upToDate={upToDate} busy={busy} canEdit={canEdit} onSync={onSync} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="Selected voice" v={`${voice.name} · ${voice.vibe}`} />
        <Stat k="Supported languages" v={langs.join(", ")} />
        <Stat k="Business hours" v={info.hours || "Not set"} warn={!info.hours} />
        <Stat k="Knowledge" v={info.services ? `${info.services} services${info.staff ? ` · ${info.staff} technicians` : ""}` : "No services yet"} warn={!info.services} />
        <Stat k="Calendar connection" v={PROVIDER[info.booking_provider] ?? info.booking_provider} />
        <Stat k="Phone connection" v={info.phone_number ? `${formatUsNumber(info.phone_number)}${info.forwarding === "verified" ? " · forwarding on" : ""}` : "No number yet"} warn={!info.phone_number} />
        <Stat k="Last updated" v={ago(info.last_synced_at)} />
        <Stat k="Greeting" v={saved!.greeting || defaultGreeting(info.name, saved!.agent_name)} small />
      </div>

      <GoogleCalendarConnect salonId={location.id} canEdit={canEdit} onChanged={load} />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-medium">Test My Agent</h3><p className="mt-1 text-sm text-muted-foreground">Talk to it in your browser like a client would.</p>
          <div className="mt-4">{info.has_receptionist ? <TestCall salonId={location.id} bare /> : <p className="text-sm text-muted-foreground">Available once your agent is built. <Link to="/setup" className="text-violet hover:underline">Finish setup</Link></p>}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-medium">Call My Agent</h3><p className="mt-1 text-sm text-muted-foreground">Call the real line from your phone.</p>
          {info.phone_number ? <a href={`tel:${info.phone_number}`} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"><Phone className="size-4" />{formatUsNumber(info.phone_number)}</a> : <p className="mt-4 text-sm text-muted-foreground">Your Salon Agent number appears here once it's set up.</p>}</div>
        <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-medium">Preview Voice</h3><p className="mt-1 text-sm text-muted-foreground">Hear your greeting in the selected voice.</p>
          <div className="mt-4"><PreviewBtn voice={s.voice} salon={info.name} text={s.greeting || defaultGreeting(info.name, s.agent_name)} /></div></div>
      </div>

      <div className="mt-8"><KnowledgeEditor salonId={location.id} canEdit={canEdit} onSaved={load} /></div>

      <fieldset disabled={!canEdit || busy} className="mt-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Settings</h2><p className="text-sm text-muted-foreground">{canEdit ? "Every saved change is sent to your Salon Agent right away." : "Only owners and managers can change these settings."}</p></div></div>

        <Card title="Identity & voice">
          <Field label="Agent name"><input className={inp} maxLength={40} value={s.agent_name} placeholder={voice.name} onChange={(e) => up({ agent_name: e.target.value })} /></Field>
          <Field label="Voice"><select className={inp} value={s.voice} onChange={(e) => up({ voice: e.target.value })}>{voices.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.vibe}</option>)}</select></Field>
          <Pick label="Speaking style" k="style" s={s} up={up} />
          <Field label="Greeting" wide><textarea className={cn(inp, "h-auto py-2")} rows={2} maxLength={240} value={s.greeting} placeholder={defaultGreeting(info.name, s.agent_name)} onChange={(e) => up({ greeting: e.target.value })} /><span className="mt-1 block text-xs text-muted-foreground">The first thing callers hear. Leave blank to use the default.</span></Field>
        </Card>

        <Card title="Languages & conversation">
          <Field label="Default language"><select className={inp} value={s.default_language} onChange={(e) => up({ default_language: e.target.value, extra_languages: s.extra_languages.filter((l) => l !== e.target.value) })}>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></Field>
          <Field label="Additional languages" wide><div className="flex flex-wrap gap-2">{LANGUAGES.filter((l) => l.code !== s.default_language).map((l) => { const on = s.extra_languages.includes(l.code); return <button type="button" key={l.code} onClick={() => up({ extra_languages: on ? s.extra_languages.filter((x) => x !== l.code) : [...s.extra_languages, l.code] })} className={cn("rounded-full px-3 py-1.5 text-sm", on ? "bg-primary text-primary-foreground" : "bg-accent")}>{l.label}</button>; })}</div></Field>
          <Toggle label="Automatic language switching" help="Switch when the caller speaks another supported language." v={s.auto_switch} on={(v) => up({ auto_switch: v })} />
          <Toggle label="Allow interruptions" help="Stop talking and listen when the caller cuts in." v={s.interruptions} on={(v) => up({ interruptions: v })} />
        </Card>

        <Card title="Calls the agent can't finish">
          <Pick label="After-hours behavior" k="after_hours" s={s} up={up} />
          <Pick label="Human transfer behavior" k="transfer" s={s} up={up} />
          <Pick label="Callback behavior" k="callback" s={s} up={up} />
          <Pick label="Walk-in responses" k="walkins" s={s} up={up} />
        </Card>

        <Card title="Booking permissions">
          <Pick label="Booking" k="booking" s={s} up={up} />
          <Pick label="Cancellations" k="cancel" s={s} up={up} />
          <Pick label="Rescheduling" k="reschedule" s={s} up={up} />
          <Pick label="Add-on suggestions" k="addons" s={s} up={up} />
          <Pick label="Deposit requests" k="deposit" s={s} up={up} />
        </Card>

        <Card title="Texts the agent mentions">
          <Toggle label="SMS confirmations" help="Tell clients they'll get a text confirmation after booking." v={s.sms_confirmations} on={(v) => up({ sms_confirmations: v })} />
          <Toggle label="Appointment reminders" help="Tell clients they'll get a reminder text." v={s.reminders} on={(v) => up({ reminders: v })} />
          <p className="text-xs text-muted-foreground sm:col-span-2">Which texts actually go out is controlled in <Link to="/dashboard/settings" className="text-violet hover:underline">Text settings</Link>.</p>
        </Card>
      </fieldset>

      {canEdit && <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
        {msg && <p className={cn("mr-auto text-sm", msg.ok ? "text-success" : "text-coral")}>{msg.t}</p>}
        <button disabled={!dirty || busy} onClick={() => { setS(saved); setMsg(null); }} className="h-10 rounded-full bg-accent px-4 text-sm disabled:opacity-50">Discard</button>
        <button disabled={!dirty || busy} onClick={onSave} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" />}Save changes</button>
      </div>}
    </div>
  );
}

const inp = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-violet disabled:opacity-60";

function SyncBar({ info, upToDate, busy, canEdit, onSync }: { info: Info; upToDate: boolean; busy: boolean; canEdit: boolean; onSync: () => void }) {
  if (!info.has_receptionist) return <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Your settings are saved and will be used when your Salon Agent is built. <Link to="/setup" className="text-violet hover:underline">Finish setup</Link></div>;
  const syncing = info.agent_sync_status === "syncing" || busy;
  return (
    <div className={cn("mt-6 flex flex-wrap items-center gap-3 rounded-2xl border p-4", upToDate ? "border-success/30 bg-success/5" : "border-coral/30 bg-coral/5")}>
      {syncing ? <Loader2 className="size-5 animate-spin text-violet" /> : upToDate ? <CheckCircle2 className="size-5 text-success" /> : <TriangleAlert className="size-5 text-coral" />}
      <div className="flex-1"><p className="font-medium">{syncing ? "Updating your Salon Agent…" : upToDate ? "Salon Agent is up to date" : info.agent_sync_status === "failed" ? "Last update didn't go through" : "Changes waiting to be sent"}</p><p className="text-sm text-muted-foreground">Last synced {ago(info.last_synced_at)}</p></div>
      {canEdit && !upToDate && <button onClick={onSync} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm"><RefreshCw className="size-4" />Update now</button>}
    </div>
  );
}

function Stat({ k, v, warn, small }: { k: string; v: string; warn?: boolean; small?: boolean }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className={cn("mt-1 font-medium", small && "line-clamp-2 text-sm", warn && "text-coral")}>{v}</p></div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-5"><h3 className="font-medium">{title}</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div></section>;
}
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={cn("block text-sm", wide && "sm:col-span-2")}><span className="mb-1 block text-xs text-muted-foreground">{label}</span>{children}</label>;
}
function Pick<K extends keyof typeof OPTIONS>({ label, k, s, up }: { label: string; k: K; s: AgentSettings; up: (p: Partial<AgentSettings>) => void }) {
  return <Field label={label}><select className={inp} value={s[k] as string} onChange={(e) => up({ [k]: e.target.value } as Partial<AgentSettings>)}>{Object.entries(OPTIONS[k]).map(([v, l]) => <option key={v} value={v}>{l as string}</option>)}</select></Field>;
}
function Toggle({ label, help, v, on }: { label: string; help: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-accent/40 p-3">
      <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{help}</p></div>
      <button type="button" role="switch" aria-checked={v} aria-label={label} onClick={() => on(!v)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", v ? "bg-primary" : "bg-border")}><span className={cn("absolute top-0.5 size-5 rounded-full bg-background transition", v ? "left-[22px]" : "left-0.5")} /></button>
    </div>
  );
}

function PreviewBtn({ voice, salon, text }: { voice: string; salon: string; text: string }) {
  const [st, setSt] = useState<"idle" | "loading" | "playing">("idle");
  const [err, setErr] = useState<string | null>(null);
  const a = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => a.current?.pause(), []);
  const go = async () => {
    if (st === "playing") { a.current?.pause(); setSt("idle"); return; }
    setErr(null); setSt("loading");
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/voice-preview", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify({ voice, salon, text }) });
    if (!res.ok) { setErr(await res.text()); setSt("idle"); return; }
    const el = new Audio(URL.createObjectURL(await res.blob())); a.current = el;
    el.onended = () => setSt("idle"); void el.play(); setSt("playing");
  };
  return <>
    <button onClick={go} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-medium">{st === "loading" ? <Loader2 className="size-4 animate-spin" /> : st === "playing" ? <Pause className="size-4" /> : <Play className="size-4" />}{st === "playing" ? "Stop" : "Play greeting"}</button>
    {err && <p className="mt-2 text-sm text-coral">{err}</p>}
  </>;
}
