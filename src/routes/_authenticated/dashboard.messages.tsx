import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, FileText, Loader2, MessageSquare, Phone, Send, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncActivity } from "@/lib/activity.functions";
import { sendText } from "@/lib/texting.functions";
import { formatUsNumber } from "@/lib/phone-format";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { cn } from "@/lib/utils";
import { Empty, Header, when } from "@/components/dashboard/activity-ui";

export const Route = createFileRoute("/_authenticated/dashboard/messages")({
  head: () => ({ meta: [{ title: "Messages — Salon Pro Agent" }, { name: "description", content: "Shared text inbox for your salon and its clients." }, { property: "og:title", content: "Messages — Salon Pro Agent" }, { property: "og:description", content: "Shared text inbox with your clients." }, { name: "robots", content: "noindex" }] }),
  component: MessagesPage,
});

type Msg = { id: string; sent_at: string; direction: string; customer_phone: string; body: string; sent_by: string };
type Thread = { customer_phone: string; customer_name: string; tags: string[]; notes: string; ai_enabled: boolean };

const TEMPLATES = (name: string, address: string) => [
  { k: "Appointment confirmation", t: `Hi! This is ${name || "the salon"} confirming your appointment on [day] at [time]. Reply C to confirm or call us to change it.` },
  { k: "Running late?", t: `No problem! Thanks for letting us know. We'll hold your spot for up to 15 minutes. See you soon!` },
  { k: "Deposit reminder", t: `Friendly reminder: a deposit is needed to hold your appointment. You can pay here: [deposit link]` },
  { k: "We missed your call", t: `Hi, it's ${name || "the salon"}. Sorry we missed your call! How can we help? You can also book here: [booking link]` },
  { k: "Address / parking", t: `We're at ${address || "[address]"}. [parking info]` },
  { k: "Booking link", t: `You can book anytime here: [booking link]` },
  { k: "Reschedule link", t: `Need a new time? You can reschedule here: [reschedule link]` },
  { k: "Cancellation link", t: `If you need to cancel, you can do it here: [cancellation link]. Please let us know at least 24 hours ahead.` },
];

function MessagesPage() {
  const { location } = useActiveLocation();
  const sync = useServerFn(syncActivity);
  const send = useServerFn(sendText);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [meta, setMeta] = useState<Record<string, Thread>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const load = useCallback(async () => {
    const [m, t] = await Promise.all([
      supabase.from("messages").select("id,sent_at,direction,customer_phone,body,sent_by").eq("salon_id", location.id).order("sent_at", { ascending: false }).limit(500),
      supabase.from("sms_threads").select("customer_phone,customer_name,tags,notes,ai_enabled").eq("salon_id", location.id),
    ]);
    setMsgs((m.data ?? []) as Msg[]);
    setMeta(Object.fromEntries((t.data ?? []).map((x) => [x.customer_phone, x as Thread])));
  }, [location.id]);
  const refresh = useCallback(async () => {
    setBusy(true); setNote(null);
    try { const r = await sync({ data: { salonId: location.id, kind: "messages" } }); if (!r.ok) setNote(location.phone_number ? "We couldn't check for new texts just now." : "Texts will appear once your salon has a Salon Pro Agent number."); }
    catch { setNote("We couldn't check for new texts just now."); }
    await load(); setBusy(false);
  }, [sync, location.id, location.phone_number, load]);
  useEffect(() => { setMsgs(null); setSel(null); void load().then(refresh); }, [load, refresh]);

  const threads = useMemo(() => {
    const m = new Map<string, Msg[]>();
    for (const x of msgs ?? []) m.set(x.customer_phone, [...(m.get(x.customer_phone) ?? []), x]);
    return [...m.entries()];
  }, [msgs]);
  const thread = sel ? (threads.find(([p]) => p === sel)?.[1] ?? []).slice().reverse() : null;
  const info: Thread | null = sel ? meta[sel] ?? { customer_phone: sel, customer_name: "", tags: [], notes: "", ai_enabled: true } : null;
  const label = (p: string) => meta[p]?.customer_name || formatUsNumber(p) || p;

  const saveThread = async (p: Partial<Thread>) => {
    if (!sel || !info) return;
    const next = { ...info, ...p };
    setMeta((m) => ({ ...m, [sel]: next }));
    const { error } = await supabase.from("sms_threads").upsert({ salon_id: location.id, customer_phone: sel, customer_name: next.customer_name, tags: next.tags, notes: next.notes, ai_enabled: next.ai_enabled, updated_at: new Date().toISOString() }, { onConflict: "salon_id,customer_phone" });
    if (error) { setNote("Couldn't save that change."); setMeta((m) => ({ ...m, [sel]: info })); }
  };
  const submit = async () => {
    if (!sel || !draft.trim()) return;
    setSending(true); setNote(null);
    try {
      const r = await send({ data: { salonId: location.id, to: sel, body: draft.trim() } });
      if (!r.ok) setNote(r.error ?? "The text couldn't be sent."); else { setDraft(""); await load(); }
    } catch { setNote("The text couldn't be sent."); }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Header title="Messages" sub="Your shared text inbox. The Salon Agent replies until a team member takes over." busy={busy} onRefresh={refresh} />
      {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}
      <div className="glass mt-6 grid h-[calc(100vh-14rem)] min-h-[520px] overflow-hidden rounded-[28px] md:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_300px]">
        <ul className={cn("divide-y divide-border overflow-y-auto border-border md:border-r", sel && "hidden md:block")}>
          {!msgs ? <li className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin" /></li>
            : !threads.length ? <li><Empty icon={MessageSquare} text="No texts yet. Conversations with clients show up here." /></li>
            : threads.map(([phone, list]) => {
              const ai = meta[phone]?.ai_enabled ?? true;
              return (
                <li key={phone}><button onClick={() => setSel(phone)} className={cn("w-full px-5 py-4 text-left hover:bg-accent", sel === phone && "bg-accent")}>
                  <span className="flex justify-between gap-2"><span className="truncate font-medium">{label(phone)}</span><span className="shrink-0 text-xs text-muted-foreground">{when(list[0]!.sent_at)}</span></span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">{list[0]!.direction === "outbound" ? (list[0]!.sent_by === "agent" ? "Agent: " : "You: ") : ""}{list[0]!.body}</span>
                  <span className={cn("mt-1.5 inline-flex items-center gap-1 text-[11px]", ai ? "text-violet" : "text-coral")}>{ai ? <Bot className="size-3" /> : <UserRound className="size-3" />}{ai ? "Salon Agent" : "Human takeover"}</span>
                </button></li>
              );
            })}
        </ul>

        <div className={cn("flex min-h-0 flex-col", !sel && "hidden md:flex")}>
          {!thread || !info ? <div className="m-auto text-sm text-muted-foreground">Pick a conversation</div> : <>
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
              <button onClick={() => setSel(null)} aria-label="Back" className="md:hidden"><ArrowLeft className="size-4" /></button>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{label(sel!)}</span>
                <span className={cn("inline-flex items-center gap-1 text-xs", info.ai_enabled ? "text-violet" : "text-coral")}>{info.ai_enabled ? <><Bot className="size-3" /> Salon Agent responding</> : <><UserRound className="size-3" /> Human takeover</>}</span></span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">Let Salon Agent handle this</span>
                <button role="switch" aria-checked={info.ai_enabled} aria-label="Let Salon Agent handle this conversation" onClick={() => saveThread({ ai_enabled: !info.ai_enabled })} className={cn("relative h-6 w-11 rounded-full transition", info.ai_enabled ? "bg-violet" : "bg-surface-2")}>
                  <span className={cn("absolute top-0.5 size-5 rounded-full bg-foreground transition-all", info.ai_enabled ? "left-[22px]" : "left-0.5")} />
                </button>
              </label>
              <a href={`tel:${sel}`} aria-label="Call" className="grid size-9 place-items-center rounded-full bg-accent"><Phone className="size-4" /></a>
              <button onClick={() => setShowInfo((v) => !v)} className="rounded-full bg-accent px-3 py-1.5 text-xs xl:hidden">Client info</button>
            </div>
            <ol className="flex-1 space-y-3 overflow-y-auto p-5">{thread.map((m) => (
              <li key={m.id} className={cn("flex flex-col", m.direction === "outbound" ? "items-end" : "items-start")}>
                <span className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm", m.direction === "outbound" ? (m.sent_by === "agent" ? "bg-violet/25" : "bg-primary text-primary-foreground") : "bg-accent")}>{m.body}</span>
                <span className="mt-1 text-[11px] text-muted-foreground">{m.direction === "outbound" ? (m.sent_by === "agent" ? "Salon Agent · " : m.sent_by === "staff" ? "Team · " : "") : ""}{when(m.sent_at)}</span>
              </li>))}</ol>
            <div className="relative border-t border-border p-3">
              {showTpl && (
                <div className="absolute bottom-full left-3 right-3 mb-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface p-2 shadow-xl">
                  {TEMPLATES(location.name, location.address).map((t) => (
                    <button key={t.k} onClick={() => { setDraft(t.t); setShowTpl(false); }} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-accent">
                      <span className="block text-sm font-medium">{t.k}</span><span className="block truncate text-xs text-muted-foreground">{t.t}</span>
                    </button>))}
                </div>)}
              <div className="flex items-end gap-2">
                <button onClick={() => setShowTpl((v) => !v)} aria-label="Templates" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent"><FileText className="size-4" /></button>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={1600}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
                  placeholder={info.ai_enabled ? "Type a reply. Sending switches to human takeover." : "Type a reply"} className="max-h-40 min-h-10 flex-1 resize-none rounded-2xl bg-accent px-4 py-2.5 text-sm outline-none" />
                <button onClick={submit} disabled={sending || !draft.trim()} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</button>
              </div>
              {/\[[a-z ]+\]/i.test(draft) && <p className="mt-2 px-1 text-xs text-coral">Fill in the parts in [brackets] before sending.</p>}
            </div>
          </>}
        </div>

        {info && (
          <aside className={cn("overflow-y-auto border-l border-border p-5", showInfo ? "fixed inset-y-0 right-0 z-50 w-80 bg-surface xl:static xl:w-auto xl:bg-transparent" : "hidden xl:block")}>
            <div className="flex items-center justify-between"><h2 className="font-medium">Client</h2><button onClick={() => setShowInfo(false)} aria-label="Close" className="xl:hidden"><X className="size-4" /></button></div>
            <ClientPanel key={sel} salonId={location.id} info={info} onSave={saveThread} />
          </aside>
        )}
      </div>
    </div>
  );
}

function ClientPanel({ salonId, info, onSave }: { salonId: string; info: Thread; onSave: (p: Partial<Thread>) => void }) {
  const [name, setName] = useState(info.customer_name);
  const [notes, setNotes] = useState(info.notes);
  const [tag, setTag] = useState("");
  const addTag = () => { const t = tag.trim().slice(0, 30); if (t && !info.tags.includes(t)) onSave({ tags: [...info.tags, t] }); setTag(""); };
  return (
    <div className="mt-4 space-y-5 text-sm">
      <label className="block"><span className="text-xs text-muted-foreground">Name</span>
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onBlur={() => name !== info.customer_name && onSave({ customer_name: name.trim() })} placeholder="Add a name" className="mt-1 h-10 w-full rounded-xl bg-accent px-3 outline-none" /></label>
      <div><span className="text-xs text-muted-foreground">Phone</span><p className="mt-1">{formatUsNumber(info.customer_phone) || info.customer_phone}</p></div>
      <Visits salonId={salonId} phone={info.customer_phone} />
      <div><span className="text-xs text-muted-foreground">Tags</span>
        <div className="mt-1 flex flex-wrap gap-1.5">{info.tags.map((t) => (
          <button key={t} onClick={() => onSave({ tags: info.tags.filter((x) => x !== t) })} className="rounded-full bg-violet/20 px-2.5 py-0.5 text-xs" title="Remove tag">{t} ×</button>))}
          <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} onBlur={addTag} placeholder="+ tag" className="w-20 rounded-full bg-accent px-2.5 py-0.5 text-xs outline-none" />
        </div></div>
      <label className="block"><span className="text-xs text-muted-foreground">Notes</span>
        <textarea value={notes} maxLength={4000} rows={5} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== info.notes && onSave({ notes })} placeholder="Private notes for your team" className="mt-1 w-full rounded-xl bg-accent p-3 outline-none" /></label>
    </div>
  );
}

function Visits({ salonId, phone }: { salonId: string; phone: string }) {
  const [v, setV] = useState<{ last: string | null; next: string | null; total: number } | null>(null);
  useEffect(() => {
    void supabase.from("appointments").select("service_name,starts_at,status").eq("salon_id", salonId).eq("client_phone", phone).order("starts_at").then(({ data }) => {
      const now = Date.now(); const rows = data ?? [];
      const past = rows.filter((r) => Date.parse(r.starts_at) < now && r.status === "completed");
      const next = rows.find((r) => Date.parse(r.starts_at) >= now && ["booked", "confirmed"].includes(r.status));
      const fmt = (r?: { service_name: string; starts_at: string }) => (r ? `${r.service_name} · ${when(r.starts_at)}` : null);
      setV({ last: fmt(past[past.length - 1]), next: fmt(next), total: past.length });
    });
  }, [salonId, phone]);
  if (!v) return null;
  return (
    <div className="space-y-2">
      {([["Upcoming appointment", v.next ?? "None"], ["Last appointment", v.last ?? "None"], ["Total visits", String(v.total)]] as const).map(([k, x]) => (
        <div key={k}><span className="text-xs text-muted-foreground">{k}</span><p className="mt-0.5">{x}</p></div>))}
      <Link to="/dashboard/appointments" search={{ new: 1, phone }} className="inline-flex h-9 items-center rounded-full bg-accent px-3 text-xs">Book appointment</Link>
    </div>
  );
}
