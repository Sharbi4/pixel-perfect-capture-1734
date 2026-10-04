import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncActivity } from "@/lib/activity.functions";
import { formatUsNumber } from "@/lib/phone-format";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { cn } from "@/lib/utils";
import { Empty, Header, when } from "./dashboard.calls";

export const Route = createFileRoute("/_authenticated/dashboard/messages")({
  head: () => ({ meta: [{ title: "Messages — Salon Pro Agent" }, { name: "description", content: "Text conversations between your salon and its clients." }, { property: "og:title", content: "Messages — Salon Pro Agent" }, { property: "og:description", content: "Text conversations with your clients." }, { name: "robots", content: "noindex" }] }),
  component: MessagesPage,
});

type Msg = { id: string; sent_at: string; direction: string; customer_phone: string; body: string };

function MessagesPage() {
  const { location } = useActiveLocation();
  const sync = useServerFn(syncActivity);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("messages").select("id,sent_at,direction,customer_phone,body").eq("salon_id", location.id).order("sent_at", { ascending: false }).limit(500);
    setMsgs((data ?? []) as Msg[]);
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

  return (
    <div className="mx-auto max-w-6xl">
      <Header title="Messages" sub="Text conversations with your clients." busy={busy} onRefresh={refresh} />
      {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}
      <div className="glass mt-6 grid min-h-[480px] overflow-hidden rounded-[28px] md:grid-cols-[320px_1fr]">
        <ul className={cn("divide-y divide-border border-border md:border-r", sel && "hidden md:block")}>
          {!msgs ? <li className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin" /></li>
            : !threads.length ? <li><Empty icon={MessageSquare} text="No texts yet. Conversations with clients show up here." /></li>
            : threads.map(([phone, list]) => (
              <li key={phone}><button onClick={() => setSel(phone)} className={cn("w-full px-5 py-4 text-left hover:bg-accent", sel === phone && "bg-accent")}>
                <span className="flex justify-between gap-2"><span className="font-medium">{formatUsNumber(phone) || phone}</span><span className="text-xs text-muted-foreground">{when(list[0]!.sent_at)}</span></span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground">{list[0]!.direction === "outbound" ? "You: " : ""}{list[0]!.body}</span>
              </button></li>))}
        </ul>
        <div className={cn("flex flex-col", !sel && "hidden md:flex")}>
          {!thread ? <div className="m-auto text-sm text-muted-foreground">Pick a conversation</div> : <>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <button onClick={() => setSel(null)} aria-label="Back" className="md:hidden"><ArrowLeft className="size-4" /></button>
              <span className="flex-1 font-medium">{formatUsNumber(sel!) || sel}</span>
              <a href={`tel:${sel}`} className="rounded-full bg-accent px-3 py-1.5 text-xs">Call</a>
            </div>
            <ol className="flex-1 space-y-3 overflow-y-auto p-5">{thread.map((m) => (
              <li key={m.id} className={cn("flex flex-col", m.direction === "outbound" ? "items-end" : "items-start")}>
                <span className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.direction === "outbound" ? "bg-violet/25" : "bg-accent")}>{m.body}</span>
                <span className="mt-1 text-[11px] text-muted-foreground">{when(m.sent_at)}</span>
              </li>))}</ol>
          </>}
        </div>
      </div>
    </div>
  );
}
