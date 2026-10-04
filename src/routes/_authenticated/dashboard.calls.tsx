import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Loader2, Pause, PhoneCall, Play, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncActivity } from "@/lib/activity.functions";
import { formatUsNumber } from "@/lib/phone-format";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { cn } from "@/lib/utils";
import { Empty, Header, dur, when } from "@/components/dashboard/activity-ui";
import { highlights, type Line } from "@/lib/call-highlights";

export const Route = createFileRoute("/_authenticated/dashboard/calls")({
  head: () => ({ meta: [{ title: "Calls — Salon Pro Agent" }, { name: "description", content: "Every call your Salon Pro Agent answered, with summaries and transcripts." }, { property: "og:title", content: "Calls — Salon Pro Agent" }, { property: "og:description", content: "Call history with summaries and transcripts." }, { name: "robots", content: "noindex" }] }),
  component: CallsPage,
});

type Call = { id: string; salon_id: string; started_at: string; duration_secs: number; direction: string; customer_phone: string; outcome: string; summary: string; title: string; transcript: Line[]; resolved_at: string | null; follow_up_at: string | null; has_recording: boolean };
type Note = { id: string; body: string; user_id: string; created_at: string };

const needsFollow = (c: Call) => !c.resolved_at && (c.outcome === "failure" || !!c.follow_up_at);
const FILTERS = [
  { k: "all", label: "All", f: (_: Call) => true },
  { k: "handled", label: "Handled", f: (c: Call) => c.outcome === "success" },
  { k: "follow", label: "Needs follow-up", f: needsFollow },
  { k: "resolved", label: "Resolved", f: (c: Call) => !!c.resolved_at },
  { k: "short", label: "Short / hung up", f: (c: Call) => c.duration_secs < 15 },
] as const;

function CallsPage() {
  const { location } = useActiveLocation();
  const sync = useServerFn(syncActivity);
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("calls").select("id,salon_id,started_at,duration_secs,direction,customer_phone,outcome,summary,title,transcript,resolved_at,follow_up_at,has_recording").eq("salon_id", location.id).order("started_at", { ascending: false }).limit(200);
    setCalls((data ?? []) as unknown as Call[]);
  }, [location.id]);

  const refresh = useCallback(async () => {
    setBusy(true); setNote(null);
    try { const r = await sync({ data: { salonId: location.id, kind: "calls" } }); if (!r.ok) setNote(location.has_receptionist ? "We couldn't check for new calls just now." : "Calls will appear once your receptionist is built."); }
    catch { setNote("We couldn't check for new calls just now."); }
    await load(); setBusy(false);
  }, [sync, location.id, location.has_receptionist, load]);

  useEffect(() => { setCalls(null); void load().then(refresh); }, [load, refresh]);

  const patch = (id: string, p: Partial<Call>) => setCalls((cs) => cs?.map((c) => (c.id === id ? { ...c, ...p } : c)) ?? null);
  const list = (calls ?? []).filter(FILTERS.find((f) => f.k === filter)!.f);
  const open = calls?.find((c) => c.id === openId) ?? null;
  return (
    <div className="mx-auto max-w-6xl">
      <Header title="Calls" sub="Every call your agent answered, newest first." busy={busy} onRefresh={refresh} />
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={cn("rounded-full px-4 py-1.5 text-sm whitespace-nowrap", filter === f.k ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground")}>
            {f.label}{calls ? ` · ${calls.filter(f.f).length}` : ""}
          </button>
        ))}
      </div>
      {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}
      <div className="glass mt-4 overflow-hidden rounded-[28px]">
        {!calls ? <div className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin" /></div>
          : !list.length ? <Empty icon={PhoneCall} text={calls.length ? "No calls match this filter." : "No calls yet. When clients call your agent, they show up here."} />
          : <ul className="divide-y divide-border">{list.map((c) => (
            <li key={c.id}><button onClick={() => setOpenId(c.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-accent">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">{c.direction === "outbound" ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4 text-success" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.title || (c.customer_phone ? formatUsNumber(c.customer_phone) : "Web or test call")}</span>
                <span className="block truncate text-sm text-muted-foreground">{c.summary || "No summary"}</span></span>
              <Status c={c} />
              <span className="hidden w-28 text-right text-xs text-muted-foreground sm:block">{when(c.started_at)}<br /><span className="font-mono">{dur(c.duration_secs)}</span></span>
            </button></li>))}</ul>}
      </div>
      {open && <CallDrawer c={open} onChange={(p) => patch(open.id, p)} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Status({ c }: { c: Call }) {
  if (c.resolved_at) return <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-muted-foreground">Resolved</span>;
  if (needsFollow(c)) return <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-xs text-coral">Follow up</span>;
  if (c.outcome === "success") return <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs text-success">Handled</span>;
  return null;
}

function Recording({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  const load = async () => {
    setState("loading");
    const { data } = await supabase.auth.getSession();
    const r = await fetch(`/api/call-recording?id=${id}`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } }).catch(() => null);
    if (!r?.ok) return setState("error");
    setSrc(URL.createObjectURL(await r.blob())); setState("idle");
  };
  if (src) return <audio controls autoPlay src={src} className="w-full" />;
  return (
    <button onClick={load} disabled={state === "loading"} className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm disabled:opacity-60">
      {state === "loading" ? <Loader2 className="size-4 animate-spin" /> : state === "error" ? <Pause className="size-4" /> : <Play className="size-4" />}
      {state === "error" ? "Recording isn't available" : "Play recording"}
    </button>
  );
}

function CallDrawer({ c, onChange, onClose }: { c: Call; onChange: (p: Partial<Call>) => void; onClose: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const hl = highlights(c.transcript);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    void supabase.from("call_notes").select("id,body,user_id,created_at").eq("call_id", c.id).order("created_at").then(({ data }) => setNotes(data ?? []));
  }, [c.id]);

  const save = async (p: { resolved_at?: string | null; follow_up_at?: string | null }) => {
    setErr(null);
    const { error } = await supabase.from("calls").update(p).eq("id", c.id);
    if (error) setErr("Couldn't save that change."); else onChange(p);
  };
  const addNote = async () => {
    const body = draft.trim(); if (!body) return;
    const { data, error } = await supabase.from("call_notes").insert({ call_id: c.id, salon_id: c.salon_id, body }).select("id,body,user_id,created_at").single();
    if (error || !data) return setErr("Couldn't save your note.");
    setNotes((n) => [...n, data]); setDraft("");
  };
  const delNote = async (id: string) => {
    const { error } = await supabase.from("call_notes").delete().eq("id", id);
    if (!error) setNotes((n) => n.filter((x) => x.id !== id));
  };
  const followDay = c.follow_up_at ? c.follow_up_at.slice(0, 10) : "";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Call details">
      <button aria-label="Close" className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-rise absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-border bg-surface">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div><h2 className="text-lg font-semibold">{c.title || "Call"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.customer_phone ? formatUsNumber(c.customer_phone) : "Web or test call"} · {when(c.started_at)} · {dur(c.duration_secs)}</p></div>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-accent"><X className="size-4" /></button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => save({ resolved_at: c.resolved_at ? null : new Date().toISOString() })} className={cn("inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm", c.resolved_at ? "bg-success/15 text-success" : "bg-primary text-primary-foreground")}>
              <CheckCircle2 className="size-4" />{c.resolved_at ? "Resolved · undo" : "Mark resolved"}
            </button>
            <label className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm">
              <Clock className="size-4" /> Follow up
              <input type="date" value={followDay} onChange={(e) => save({ follow_up_at: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} className="bg-transparent text-sm outline-none" aria-label="Follow-up date" />
            </label>
          </div>
          {err && <p className="text-sm text-coral">{err}</p>}

          <section><h3 className="text-xs uppercase tracking-wider text-muted-foreground">Summary</h3><p className="mt-2 text-sm leading-relaxed">{c.summary || "No summary for this call."}</p></section>
          {c.has_recording && <section><h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Recording</h3><Recording id={c.id} /></section>}
          {c.customer_phone && <div className="flex gap-2">
            <a href={`tel:${c.customer_phone}`} className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">Call customer</a>
            <a href={`sms:${c.customer_phone}`} className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm">Text customer</a></div>}

          {hl.length > 0 && <section><h3 className="text-xs uppercase tracking-wider text-muted-foreground">Key moments</h3>
            <ul className="mt-2 space-y-2">{hl.map((h) => (
              <li key={h.kind} className="rounded-2xl bg-accent px-4 py-2.5 text-sm"><span className="font-medium text-violet">{h.label}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{dur(h.t)}</span><p className="mt-0.5 line-clamp-2 text-muted-foreground">{h.text}</p></li>))}</ul>
          </section>}

          <section><h3 className="text-xs uppercase tracking-wider text-muted-foreground">Team notes</h3>
            <ul className="mt-2 space-y-2">{notes.map((n) => (
              <li key={n.id} className="group flex items-start gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm">
                <span className="flex-1 whitespace-pre-wrap">{n.body}<span className="mt-1 block text-[11px] text-muted-foreground">{when(n.created_at)}</span></span>
                {n.user_id === me && <button onClick={() => delNote(n.id)} aria-label="Delete note" className="text-muted-foreground hover:text-coral"><Trash2 className="size-4" /></button>}
              </li>))}</ul>
            <div className="mt-2 flex gap-2">
              <input value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add a private note for your team" className="h-10 flex-1 rounded-full bg-accent px-4 text-sm outline-none" />
              <button onClick={addNote} disabled={!draft.trim()} className="h-10 rounded-full bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">Add</button>
            </div>
          </section>

          <section><h3 className="text-xs uppercase tracking-wider text-muted-foreground">Transcript</h3>
            {!c.transcript.length ? <p className="mt-2 text-sm text-muted-foreground">No transcript.</p> :
            <ol className="mt-3 space-y-3">{c.transcript.map((l, i) => (
              <li key={i} className={cn("flex flex-col", l.role === "agent" ? "items-start" : "items-end")}>
                <span className="mb-1 text-[11px] text-muted-foreground">{l.role === "agent" ? "Salon Agent" : "Customer"} · {dur(l.t)}</span>
                <span className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-sm", l.role === "agent" ? "bg-accent" : "bg-violet/25")}>{l.text}</span>
              </li>))}</ol>}
          </section>
        </div>
      </div>
    </div>
  );
}
