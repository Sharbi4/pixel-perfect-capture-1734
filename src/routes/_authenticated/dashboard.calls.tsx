import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, PhoneCall, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncActivity } from "@/lib/activity.functions";
import { formatUsNumber } from "@/lib/phone-format";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { cn } from "@/lib/utils";
import { Empty, Header, dur, when } from "@/components/dashboard/activity-ui";

export const Route = createFileRoute("/_authenticated/dashboard/calls")({
  head: () => ({ meta: [{ title: "Calls — Salon Pro Agent" }, { name: "description", content: "Every call your Salon Pro Agent answered, with summaries and transcripts." }, { property: "og:title", content: "Calls — Salon Pro Agent" }, { property: "og:description", content: "Call history with summaries and transcripts." }, { name: "robots", content: "noindex" }] }),
  component: CallsPage,
});

type Line = { role: "agent" | "customer"; text: string; t: number };
type Call = { id: string; started_at: string; duration_secs: number; direction: string; customer_phone: string; outcome: string; summary: string; title: string; transcript: Line[] };

const FILTERS = [
  { k: "all", label: "All", f: (_: Call) => true },
  { k: "handled", label: "Handled", f: (c: Call) => c.outcome === "success" },
  { k: "follow", label: "Needs follow-up", f: (c: Call) => c.outcome === "failure" },
  { k: "short", label: "Short / hung up", f: (c: Call) => c.duration_secs < 15 },
] as const;


function CallsPage() {
  const { location } = useActiveLocation();
  const sync = useServerFn(syncActivity);
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<Call | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("calls").select("id,started_at,duration_secs,direction,customer_phone,outcome,summary,title,transcript").eq("salon_id", location.id).order("started_at", { ascending: false }).limit(200);
    setCalls((data ?? []) as unknown as Call[]);
  }, [location.id]);

  const refresh = useCallback(async () => {
    setBusy(true); setNote(null);
    try { const r = await sync({ data: { salonId: location.id, kind: "calls" } }); if (!r.ok) setNote(location.has_receptionist ? "We couldn't check for new calls just now." : "Calls will appear once your receptionist is built."); }
    catch { setNote("We couldn't check for new calls just now."); }
    await load(); setBusy(false);
  }, [sync, location.id, location.has_receptionist, load]);

  useEffect(() => { setCalls(null); void load().then(refresh); }, [load, refresh]);

  const list = (calls ?? []).filter(FILTERS.find((f) => f.k === filter)!.f);
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
            <li key={c.id}><button onClick={() => setOpen(c)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-accent">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">{c.direction === "outbound" ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4 text-success" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.title || (c.customer_phone ? formatUsNumber(c.customer_phone) : "Web or test call")}</span>
                <span className="block truncate text-sm text-muted-foreground">{c.summary || "No summary"}</span></span>
              <Outcome o={c.outcome} />
              <span className="hidden w-28 text-right text-xs text-muted-foreground sm:block">{when(c.started_at)}<br /><span className="font-mono">{dur(c.duration_secs)}</span></span>
            </button></li>))}</ul>}
      </div>
      {open && <CallDrawer c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Outcome({ o }: { o: string }) {
  if (o === "success") return <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs text-success">Handled</span>;
  if (o === "failure") return <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-xs text-coral">Follow up</span>;
  return null;
}

function CallDrawer({ c, onClose }: { c: Call; onClose: () => void }) {
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
          <section><h3 className="text-xs uppercase tracking-wider text-muted-foreground">Summary</h3><p className="mt-2 text-sm leading-relaxed">{c.summary || "No summary for this call."}</p></section>
          {c.customer_phone && <div className="flex gap-2">
            <a href={`tel:${c.customer_phone}`} className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">Call customer</a>
            <a href={`sms:${c.customer_phone}`} className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm">Text customer</a></div>}
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
