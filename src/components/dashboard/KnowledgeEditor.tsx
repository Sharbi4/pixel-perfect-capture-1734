import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveKnowledge } from "@/lib/catalog.functions";
import { EMPTY_KNOWLEDGE, PAYMENT_METHODS, readKnowledge, type Knowledge } from "@/lib/knowledge";
import { cn } from "@/lib/utils";

type Basics = { name: string; address: string; phone: string; website: string; hours: string; deposit_policy: string; cancellation_policy: string; walk_ins: boolean };
const TABS = [["info", "Business Information"], ["policies", "Policies"], ["faq", "FAQs"], ["parking", "Parking"], ["payments", "Payment Methods"], ["special", "Special Instructions"]] as const;
const inp = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-violet";
const area = "w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-violet";

export function KnowledgeEditor({ salonId, canEdit, onSaved }: { salonId: string; canEdit: boolean; onSaved: () => void }) {
  const save = useServerFn(saveKnowledge);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("info");
  const [b, setB] = useState<Basics | null>(null);
  const [k, setK] = useState<Knowledge>(EMPTY_KNOWLEDGE);
  const [orig, setOrig] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("salons").select("name,address,phone,website,hours,deposit_policy,cancellation_policy,walk_ins,knowledge").eq("id", salonId).single();
    if (!data) return;
    const { knowledge, ...basics } = data;
    const kk = readKnowledge(knowledge);
    setB(basics); setK(kk); setOrig(JSON.stringify([basics, kk]));
  }, [salonId]);
  useEffect(() => { setB(null); void load(); }, [load]);
  if (!b) return <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

  const dirty = JSON.stringify([b, k]) !== orig;
  const ub = (p: Partial<Basics>) => setB({ ...b, ...p });
  const uk = (p: Partial<Knowledge>) => setK({ ...k, ...p });
  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await save({ data: { salonId, basics: b, knowledge: { ...k, faqs: k.faqs.filter((f) => f.q.trim() || f.a.trim()) } } });
      setMsg(r.sync === "synced" ? { ok: true, t: "Saved and sent to your Salon Agent." } : r.sync === "no_agent" ? { ok: true, t: "Saved. Your Salon Agent will use it once it's built." } : { ok: false, t: "Saved, but your Salon Agent couldn't be updated yet. Try “Update now”." });
      await load(); onSaved();
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Business knowledge</h2>
      <p className="text-sm text-muted-foreground">What your Salon Agent knows about your business. {canEdit ? "Saving updates your agent right away." : "Only owners and managers can edit this."}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{TABS.map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={cn("rounded-full px-3 py-1.5 text-sm", tab === id ? "bg-primary text-primary-foreground" : "bg-accent")}>{l}</button>)}</div>
      <fieldset disabled={!canEdit || busy} className="mt-5">
        {tab === "info" && <div className="grid gap-4 sm:grid-cols-2">
          <F t="Salon name"><input className={inp} maxLength={120} value={b.name} onChange={(e) => ub({ name: e.target.value })} /></F>
          <F t="Phone"><input className={inp} maxLength={30} value={b.phone} onChange={(e) => ub({ phone: e.target.value })} /></F>
          <F t="Address" wide><input className={inp} maxLength={300} value={b.address} onChange={(e) => ub({ address: e.target.value })} /></F>
          <F t="Website"><input className={inp} maxLength={300} value={b.website} onChange={(e) => ub({ website: e.target.value })} /></F>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={b.walk_ins} onChange={(e) => ub({ walk_ins: e.target.checked })} />Walk-ins welcome</label>
          <F t="Business hours" wide><textarea className={area} rows={3} maxLength={600} value={b.hours} placeholder="Mon–Sat 9am–7pm, Sun 10am–5pm" onChange={(e) => ub({ hours: e.target.value })} /></F>
          <F t="About the salon" wide><textarea className={area} rows={3} maxLength={1500} value={k.about} placeholder="Specialties, languages spoken by staff, kids welcome…" onChange={(e) => uk({ about: e.target.value })} /></F>
        </div>}
        {tab === "policies" && <div className="grid gap-4">
          <F t="Deposit policy"><textarea className={area} rows={2} maxLength={600} value={b.deposit_policy} onChange={(e) => ub({ deposit_policy: e.target.value })} /></F>
          <F t="Cancellation & late policy"><textarea className={area} rows={2} maxLength={600} value={b.cancellation_policy} onChange={(e) => ub({ cancellation_policy: e.target.value })} /></F>
          <F t="Other policies"><textarea className={area} rows={4} maxLength={3000} value={k.policies} placeholder="Children, pets, refunds, fixes within 7 days…" onChange={(e) => uk({ policies: e.target.value })} /></F>
        </div>}
        {tab === "faq" && <div className="space-y-3">
          {k.faqs.map((f, i) => <div key={i} className="rounded-xl border border-border p-3">
            <div className="flex gap-2"><input className={inp} maxLength={200} placeholder="Question" value={f.q} onChange={(e) => uk({ faqs: k.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
              <button onClick={() => uk({ faqs: k.faqs.filter((_, j) => j !== i) })} aria-label="Remove question" className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent"><Trash2 className="size-4" /></button></div>
            <textarea className={cn(area, "mt-2")} rows={2} maxLength={800} placeholder="Answer" value={f.a} onChange={(e) => uk({ faqs: k.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
          </div>)}
          {k.faqs.length < 30 && <button onClick={() => uk({ faqs: [...k.faqs, { q: "", a: "" }] })} className="inline-flex items-center gap-2 text-sm text-violet"><Plus className="size-4" />Add question</button>}
        </div>}
        {tab === "parking" && <F t="Parking & directions"><textarea className={area} rows={4} maxLength={800} value={k.parking} placeholder="Free lot behind the building; enter from 5th St…" onChange={(e) => uk({ parking: e.target.value })} /></F>}
        {tab === "payments" && <div className="space-y-4">
          <div className="flex flex-wrap gap-2">{PAYMENT_METHODS.map((m) => { const on = k.payments.includes(m); return <button type="button" key={m} onClick={() => uk({ payments: on ? k.payments.filter((x) => x !== m) : [...k.payments, m] })} className={cn("rounded-full px-3 py-1.5 text-sm", on ? "bg-primary text-primary-foreground" : "bg-accent")}>{m}</button>; })}</div>
          <F t="Payment notes"><textarea className={area} rows={2} maxLength={500} value={k.payment_notes} placeholder="Cash tips appreciated; 3% card fee under $20…" onChange={(e) => uk({ payment_notes: e.target.value })} /></F>
        </div>}
        {tab === "special" && <F t="Special instructions for your Salon Agent"><textarea className={area} rows={5} maxLength={1500} value={k.special} placeholder="Mention our spring pedicure special; Linh is off on Tuesdays…" onChange={(e) => uk({ special: e.target.value })} /><span className="mt-1 block text-xs text-muted-foreground">Shared with your agent as information. It still follows its built-in safety and booking rules.</span></F>}
      </fieldset>
      {canEdit && <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {msg && <p className={cn("mr-auto text-sm", msg.ok ? "text-success" : "text-coral")}>{msg.t}</p>}
        <button disabled={!dirty || busy} onClick={() => void load()} className="h-10 rounded-full bg-accent px-4 text-sm disabled:opacity-50">Discard</button>
        <button disabled={!dirty || busy} onClick={submit} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" />}Save knowledge</button>
      </div>}
    </section>
  );
}

function F({ t, wide, children }: { t: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={cn("block text-sm", wide && "sm:col-span-2")}><span className="mb-1 block text-xs text-muted-foreground">{t}</span>{children}</label>;
}
