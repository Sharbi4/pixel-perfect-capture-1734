import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Scissors, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { Empty } from "@/components/dashboard/activity-ui";
import { applyMenuChanges, deleteService, parseMenu, saveService, setServiceArchived } from "@/lib/catalog.functions";
import { diffMenu, summarize, type Change, type NewSvc } from "@/lib/menu-diff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/services")({
  head: () => ({ meta: [{ title: "Services & Menu — Salon Pro Agent" }, { name: "description", content: "Manage your salon's services, prices, durations, add-ons and deposits." }, { property: "og:title", content: "Services & Menu — Salon Pro Agent" }, { property: "og:description", content: "Service catalog and menu uploads for your Salon Agent." }, { name: "robots", content: "noindex" }] }),
  component: ServicesPage,
});

type Svc = { id: string; name: string; price: number; minutes: number; is_addon: boolean; description: string; deposit_cents: number; days: number[]; archived: boolean; position: number };
type Staff = { id: string; name: string; service_ids: string[] };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const money = (n: number) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;
const syncNote = (s: string) => (s === "synced" ? "Saved and sent to your Salon Agent." : s === "no_agent" ? "Saved. Your Salon Agent will use it once it's built." : "Saved, but your Salon Agent couldn't be updated yet — use “Update now” on the Salon Agent page.");

function ServicesPage() {
  const { location } = useActiveLocation();
  const canEdit = location.role !== "staff";
  const [svcs, setSvcs] = useState<Svc[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tab, setTab] = useState<"active" | "addons" | "archived">("active");
  const [edit, setEdit] = useState<Partial<Svc> | null>(null);
  const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null);
  const [review, setReview] = useState<NewSvc[] | null>(null);
  const archive = useServerFn(setServiceArchived);
  const del = useServerFn(deleteService);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("services").select("id,name,price,minutes,is_addon,description,deposit_cents,days,archived,position").eq("salon_id", location.id).order("position").order("created_at"),
      supabase.from("staff").select("id,name,service_ids").eq("salon_id", location.id).eq("active", true).order("position"),
    ]);
    setSvcs(((a.data ?? []) as Svc[]).map((s) => ({ ...s, price: Number(s.price) })));
    setStaff((b.data ?? []) as Staff[]);
  }, [location.id]);
  useEffect(() => { setSvcs(null); void load(); }, [load]);

  const shown = (svcs ?? []).filter((s) => (tab === "archived" ? s.archived : !s.archived && (tab === "addons" ? s.is_addon : !s.is_addon)));
  const run = async (f: () => Promise<{ sync: string }>) => { setNote(null); try { const r = await f(); setNote({ ok: r.sync !== "failed", t: syncNote(r.sync) }); } catch (e) { setNote({ ok: false, t: (e as Error).message }); } await load(); };
  const who = (id: string) => staff.filter((t) => !t.service_ids.length || t.service_ids.includes(id)).map((t) => t.name);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold tracking-tight">Services & Menu</h1><p className="mt-1 text-muted-foreground">What your Salon Agent quotes and books. Changes go live after you save.</p></div>
        {canEdit && <div className="flex gap-2">
          <UploadMenu salonId={location.id} onParsed={setReview} onError={(t) => setNote({ ok: false, t })} />
          <button onClick={() => setEdit({ name: "", price: 0, minutes: 30, is_addon: tab === "addons", description: "", deposit_cents: 0, days: [] })} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="size-4" />Add service</button>
        </div>}
      </div>
      {note && <p className={cn("mt-4 rounded-2xl border px-4 py-3 text-sm", note.ok ? "border-success/30 text-success" : "border-coral/30 text-coral")}>{note.t}</p>}
      <div className="mt-6 flex gap-1.5">{([["active", "Services"], ["addons", "Add-ons"], ["archived", "Archived"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn("rounded-full px-4 py-1.5 text-sm", tab === k ? "bg-primary text-primary-foreground" : "bg-accent")}>{l} <span className="opacity-60">{(svcs ?? []).filter((s) => (k === "archived" ? s.archived : !s.archived && (k === "addons" ? s.is_addon : !s.is_addon))).length}</span></button>)}</div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {!svcs ? <div className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          : !shown.length ? <Empty icon={Scissors} text={tab === "archived" ? "Archived services appear here. They're hidden from your Salon Agent but kept for history." : "No services yet. Add one or upload your menu."} />
          : <ul className="divide-y divide-border">{shown.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4">
              <div className="min-w-0 flex-1"><p className="font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[s.description, s.days.length ? `Only ${s.days.map((d) => DAYS[d]).join(", ")}` : "", staff.length ? `${who(s.id).length ? who(s.id).join(", ") : "No technicians"}` : ""].filter(Boolean).join(" · ") || "—"}</p></div>
              <span className="text-sm text-muted-foreground">{s.minutes} min</span>
              {s.deposit_cents > 0 && <span className="rounded-full bg-violet/15 px-2 py-0.5 text-xs text-violet">{money(s.deposit_cents / 100)} deposit</span>}
              <span className="w-16 text-right font-medium">{money(s.price)}</span>
              {canEdit && <div className="flex gap-1">
                {!s.archived && <IconBtn label="Edit" onClick={() => setEdit(s)}><Pencil className="size-4" /></IconBtn>}
                <IconBtn label={s.archived ? "Restore" : "Archive"} onClick={() => run(() => archive({ data: { salonId: location.id, id: s.id, archived: !s.archived } }))}>{s.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}</IconBtn>
                {s.archived && <IconBtn label="Delete permanently" onClick={() => confirm(`Delete “${s.name}” permanently?`) && run(() => del({ data: { salonId: location.id, id: s.id } }))}><Trash2 className="size-4" /></IconBtn>}
              </div>}
            </li>))}</ul>}
      </div>

      {edit && <EditService salonId={location.id} svc={edit} staff={staff} onClose={() => setEdit(null)} onSaved={async (s) => { setEdit(null); setNote({ ok: s !== "failed", t: syncNote(s) }); await load(); }} />}
      {review && svcs && <Review salonId={location.id} live={svcs} incoming={review} onClose={() => setReview(null)} onDone={async (t) => { setReview(null); setNote(t); await load(); }} />}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} aria-label={label} title={label} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">{children}</button>;
}
const inp = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-violet";

function EditService({ salonId, svc, staff, onClose, onSaved }: { salonId: string; svc: Partial<Svc>; staff: Staff[]; onClose: () => void; onSaved: (s: string) => void }) {
  const save = useServerFn(saveService);
  const [f, setF] = useState({ name: svc.name ?? "", price: String(svc.price ?? 0), minutes: String(svc.minutes ?? 30), is_addon: !!svc.is_addon, description: svc.description ?? "", deposit: String((svc.deposit_cents ?? 0) / 100), days: svc.days ?? [] });
  const [techs, setTechs] = useState<string[]>(() => staff.filter((t) => !svc.id || !t.service_ids.length || t.service_ids.includes(svc.id)).map((t) => t.id));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await save({ data: { salonId, service: { id: svc.id, name: f.name, price: Number(f.price) || 0, minutes: Math.round(Number(f.minutes) || 30), is_addon: f.is_addon, description: f.description, deposit_cents: Math.round((Number(f.deposit) || 0) * 100), days: f.days, ...(staff.length ? { staff_ids: techs } : {}) } } });
      onSaved(r.sync);
    } catch (e) { setErr((e as Error).message.includes("required") ? "Please enter a service name." : (e as Error).message); setBusy(false); }
  };
  return (
    <Drawer title={svc.id ? "Edit service" : "New service"} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <L t="Name" wide><input className={inp} maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
        <L t="Price ($)"><input className={inp} type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></L>
        <L t="Duration (minutes)"><input className={inp} type="number" min={5} step={5} value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></L>
        <L t="Deposit required ($, 0 = none)"><input className={inp} type="number" min={0} step="1" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} /></L>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={f.is_addon} onChange={(e) => setF({ ...f, is_addon: e.target.checked })} />This is an add-on</label>
        <L t="Description" wide><textarea className={cn(inp, "h-auto py-2")} rows={3} maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What's included, who it's for…" /></L>
        <L t="Days offered (none selected = every open day)" wide><div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => { const on = f.days.includes(i); return <button type="button" key={d} onClick={() => setF({ ...f, days: on ? f.days.filter((x) => x !== i) : [...f.days, i] })} className={cn("rounded-full px-3 py-1.5 text-sm", on ? "bg-primary text-primary-foreground" : "bg-accent")}>{d}</button>; })}</div></L>
        {staff.length > 0 && <L t="Technicians who do this" wide><div className="flex flex-wrap gap-1.5">{staff.map((t) => { const on = techs.includes(t.id); return <button type="button" key={t.id} onClick={() => setTechs(on ? techs.filter((x) => x !== t.id) : [...techs, t.id])} className={cn("rounded-full px-3 py-1.5 text-sm", on ? "bg-primary text-primary-foreground" : "bg-accent")}>{t.name}</button>; })}</div></L>}
      </div>
      {err && <p className="mt-3 text-sm text-coral">{err}</p>}
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="h-10 rounded-full bg-accent px-4 text-sm">Cancel</button><button disabled={busy} onClick={submit} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="size-4 animate-spin" />}Save</button></div>
    </Drawer>
  );
}

function L({ t, wide, children }: { t: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={cn("block text-sm", wide && "sm:col-span-2")}><span className="mb-1 block text-xs text-muted-foreground">{t}</span>{children}</label>;
}
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-accent"><X className="size-4" /></button></div>
        {children}
      </aside>
    </div>
  );
}

function UploadMenu({ salonId, onParsed, onError }: { salonId: string; onParsed: (s: NewSvc[]) => void; onError: (t: string) => void }) {
  const parse = useServerFn(parseMenu);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const go = async (file: File) => {
    if (file.size > 10_000_000) { onError("That file is over 10 MB. Try a smaller photo or PDF."); return; }
    setBusy(true);
    try {
      const n = file.name.toLowerCase();
      let input: { kind: "pdf" | "image" | "text"; data: string; mediaType: string };
      if (file.type === "application/pdf" || n.endsWith(".pdf")) input = { kind: "pdf", data: await b64(file), mediaType: "application/pdf" };
      else if (file.type.startsWith("image/")) input = { kind: "image", data: await b64(file), mediaType: file.type };
      else if (/\.(xlsx|xls|ods)$/.test(n)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer());
        input = { kind: "text", data: wb.SheetNames.map((s) => XLSX.utils.sheet_to_csv(wb.Sheets[s]!)).join("\n"), mediaType: "text/csv" };
      } else if (/\.(csv|txt|tsv)$/.test(n) || file.type.startsWith("text/")) input = { kind: "text", data: await file.text(), mediaType: "text/csv" };
      else { onError("Please upload a PDF, photo, spreadsheet or CSV."); return; }
      const r = await parse({ data: { salonId, ...input } });
      if (r.error) onError(r.error); else onParsed(r.services);
    } catch (e) { onError((e as Error).message || "We couldn't read that file."); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return <>
    <input ref={ref} type="file" hidden accept=".pdf,image/*,.csv,.tsv,.txt,.xlsx,.xls,.ods" onChange={(e) => e.target.files?.[0] && go(e.target.files[0])} />
    <button onClick={() => ref.current?.click()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{busy ? "Reading menu…" : "Upload new menu"}</button>
  </>;
}
const b64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });

function Review({ salonId, live, incoming, onClose, onDone }: { salonId: string; live: Svc[]; incoming: NewSvc[]; onClose: () => void; onDone: (n: { ok: boolean; t: string }) => void }) {
  const apply = useServerFn(applyMenuChanges);
  const changes = useMemo(() => diffMenu(live, incoming), [live, incoming]);
  // Removals start unchecked: an upload may be a partial menu.
  const [on, setOn] = useState<Set<string>>(() => new Set(changes.filter((c) => c.kind !== "remove").map((c) => c.key)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const n = summarize(changes);
  const parts = [n.add && `${n.add} new service${n.add > 1 ? "s" : ""}`, n.price && `${n.price} price change${n.price > 1 ? "s" : ""}`, n.other && `${n.other} other update${n.other > 1 ? "s" : ""}`, n.remove && `${n.remove} service${n.remove > 1 ? "s" : ""} not on the new menu`].filter(Boolean);
  const toggle = (k: string) => setOn((s) => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });
  const publish = async () => {
    const pick = changes.filter((c) => on.has(c.key));
    setBusy(true); setErr(null);
    try {
      const r = await apply({ data: {
        salonId,
        add: pick.flatMap((c) => (c.kind === "add" ? [{ ...c.next, description: "", deposit_cents: 0, days: [] }] : [])),
        update: pick.flatMap((c) => (c.kind === "update" ? [{ id: c.id, price: c.next.price, minutes: c.next.minutes, is_addon: c.next.is_addon }] : [])),
        archive: pick.flatMap((c) => (c.kind === "remove" ? [c.prev.id] : [])),
      } });
      onDone({ ok: r.sync !== "failed", t: `Menu updated: ${r.counts.added} added, ${r.counts.updated} updated, ${r.counts.archived} archived. ${syncNote(r.sync)}` });
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const Row = ({ c }: { c: Change }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
      <input type="checkbox" className="mt-1" checked={on.has(c.key)} onChange={() => toggle(c.key)} />
      <div className="flex-1 text-sm">
        {c.kind === "add" && <><p className="font-medium">{c.next.name}{c.next.is_addon && <span className="text-muted-foreground"> · add-on</span>}</p><p className="text-xs text-muted-foreground">{money(c.next.price)} · {c.next.minutes} min</p></>}
        {c.kind === "update" && <><p className="font-medium">{c.prev.name}{c.restore && <span className="text-violet"> · restore from archive</span>}</p><p className="text-xs text-muted-foreground">
          {c.price && <>Price {money(c.prev.price)} → <b className="text-foreground">{money(c.next.price)}</b> </>}
          {c.minutes && <>· Duration {c.prev.minutes} → <b className="text-foreground">{c.next.minutes} min</b> </>}
          {c.addon && <>· {c.next.is_addon ? "Now an add-on" : "No longer an add-on"}</>}</p></>}
        {c.kind === "remove" && <><p className="font-medium">{c.prev.name}</p><p className="text-xs text-muted-foreground">Not on the uploaded menu — check to archive it ({money(c.prev.price)})</p></>}
      </div>
    </label>
  );
  const groups: [string, Change[]][] = [["New services", changes.filter((c) => c.kind === "add")], ["Changes", changes.filter((c) => c.kind === "update")], ["Not on the new menu", changes.filter((c) => c.kind === "remove")]];
  return (
    <Drawer title="Review menu changes" onClose={onClose}>
      <p className="text-sm text-muted-foreground">We read {incoming.length} items from your menu. Nothing changes until you publish. Uncheck anything that looks wrong.</p>
      {changes.length ? <p className="mt-3 rounded-2xl bg-accent/60 px-4 py-3 font-medium">{parts.join(" · ")}</p> : <p className="mt-3 rounded-2xl bg-accent/60 px-4 py-3">Your live menu already matches this upload.</p>}
      {groups.map(([t, list]) => list.length > 0 && <div key={t} className="mt-6"><h3 className="mb-2 text-sm font-semibold">{t}</h3><div className="space-y-2">{list.map((c) => <Row key={c.key} c={c} />)}</div></div>)}
      {err && <p className="mt-3 text-sm text-coral">{err}</p>}
      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 bg-card py-3"><button onClick={onClose} className="h-10 rounded-full bg-accent px-4 text-sm">Discard</button>
        <button disabled={busy || !on.size} onClick={publish} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" />}Approve & publish {on.size} change{on.size === 1 ? "" : "s"}</button></div>
    </Drawer>
  );
}
