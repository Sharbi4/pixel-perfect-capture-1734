import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, Loader2, MessageSquare, Phone, Search, StickyNote, Trash2, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatUsNumber } from "@/lib/phone-format";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { Empty, when } from "@/components/dashboard/activity-ui";
import { ACTIVE, BOOKED_BY, DEPOSIT, STATUS } from "@/lib/appointments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/customers")({
  head: () => ({ meta: [{ title: "Customers — Salon Pro Agent" }, { name: "description", content: "Every client who called, texted or booked, with their full history." }, { property: "og:title", content: "Customers — Salon Pro Agent" }, { property: "og:description", content: "Lightweight client profiles and timelines for your salon." }, { name: "robots", content: "noindex" }] }),
  component: CustomersPage,
});

type Appt = { id: string; client_name: string; client_phone: string; service_name: string; price: number; staff_id: string | null; starts_at: string; status: string; source: string; deposit_status: string; deposit_cents: number };
type Call = { id: string; customer_phone: string; started_at: string; duration_secs: number; direction: string; title: string; summary: string };
type Msg = { id: string; customer_phone: string; sent_at: string; direction: string; body: string; sent_by: string };
type Profile = { customer_phone: string; customer_name: string; email: string; preferred_language: string; preferred_staff_id: string | null; tags: string[]; notes: string; ai_enabled: boolean; opted_out?: boolean; marketing_opt_in?: boolean };
type Note = { id: string; customer_phone: string; body: string; user_id: string; created_at: string };
type Data = { appts: Appt[]; calls: Call[]; msgs: Msg[]; profiles: Record<string, Profile>; notes: Note[]; staff: { id: string; name: string }[] };

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function CustomersPage() {
  const { location } = useActiveLocation();
  const [d, setD] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = location.id;
    const [a, c, m, t, n, s, u] = await Promise.all([
      supabase.from("appointments").select("id,client_name,client_phone,service_name,price,staff_id,starts_at,status,source,deposit_status,deposit_cents").eq("salon_id", id).order("starts_at", { ascending: false }).limit(2000),
      supabase.from("calls").select("id,customer_phone,started_at,duration_secs,direction,title,summary").eq("salon_id", id).order("started_at", { ascending: false }).limit(1000),
      supabase.from("messages").select("id,customer_phone,sent_at,direction,body,sent_by").eq("salon_id", id).order("sent_at", { ascending: false }).limit(2000),
      supabase.from("sms_threads").select("customer_phone,customer_name,email,preferred_language,preferred_staff_id,tags,notes,ai_enabled,opted_out,marketing_opt_in").eq("salon_id", id),
      supabase.from("customer_notes").select("id,customer_phone,body,user_id,created_at").eq("salon_id", id).order("created_at", { ascending: false }),
      supabase.from("staff").select("id,name").eq("salon_id", id).order("position"),
      supabase.auth.getUser(),
    ]);
    setMe(u.data.user?.id ?? null);
    setD({ appts: (a.data ?? []) as Appt[], calls: (c.data ?? []) as Call[], msgs: (m.data ?? []) as Msg[], profiles: Object.fromEntries((t.data ?? []).map((x) => [x.customer_phone, x as Profile])), notes: (n.data ?? []) as Note[], staff: s.data ?? [] });
  }, [location.id]);
  useEffect(() => { setD(null); setSel(null); void load(); }, [load]);

  const list = useMemo(() => {
    if (!d) return [];
    const map = new Map<string, { phone: string; name: string; last: string; appts: number; value: number; upcoming: number }>();
    const touch = (phone: string, at: string, name = "") => {
      if (!phone) return null;
      const r = map.get(phone) ?? { phone, name: "", last: at, appts: 0, value: 0, upcoming: 0 };
      if (at > r.last) r.last = at; if (!r.name && name) r.name = name; map.set(phone, r); return r;
    };
    const now = new Date().toISOString();
    for (const a of d.appts) { const r = touch(a.client_phone, a.starts_at > now ? now : a.starts_at, a.client_name)!; if (a.status !== "cancelled") { r.appts++; r.value += Number(a.price) || 0; } if (ACTIVE.includes(a.status) && a.starts_at > now) r.upcoming++; }
    for (const c of d.calls) touch(c.customer_phone, c.started_at);
    for (const m of d.msgs) touch(m.customer_phone, m.sent_at);
    for (const p of Object.values(d.profiles)) { const r = touch(p.customer_phone, "1970"); if (r && p.customer_name) r.name = p.customer_name; }
    const term = q.trim().toLowerCase(); const digits = term.replace(/\D/g, "");
    return [...map.values()].filter((r) => !term || r.name.toLowerCase().includes(term) || (digits && r.phone.includes(digits)) || (d.profiles[r.phone]?.tags ?? []).some((t) => t.toLowerCase().includes(term))).sort((a, b) => b.last.localeCompare(a.last));
  }, [d, q]);

  return (
    <div className="mx-auto max-w-6xl">
      <div><h1 className="text-3xl font-semibold tracking-tight">Customers</h1><p className="mt-1 text-muted-foreground">Everyone who called, texted or booked — with their full history.</p></div>
      <div className="relative mt-6"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or tag" className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm outline-none focus:border-violet" /></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {!d ? <div className="grid place-items-center py-20"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          : !list.length ? <Empty icon={Users} text={q ? "No customers match that search." : "Customers appear here once someone calls, texts or books."} />
          : <ul className="divide-y divide-border">{list.map((r) => {
              const p = d.profiles[r.phone];
              return (
                <li key={r.phone}><button onClick={() => setSel(r.phone)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 text-left hover:bg-accent/50">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.name || formatUsNumber(r.phone) || r.phone}</p><p className="text-xs text-muted-foreground">{formatUsNumber(r.phone) || r.phone}{p?.tags?.length ? ` · ${p.tags.join(", ")}` : ""}</p></div>
                  <span className="text-xs text-muted-foreground">{r.appts} visit{r.appts === 1 ? "" : "s"}{r.upcoming ? ` · ${r.upcoming} upcoming` : ""}</span>
                  <span className="w-20 text-right text-sm font-medium">{money(r.value)}</span>
                </button></li>
              );
            })}</ul>}
      </div>
      {sel && d && <Profile phone={sel} d={d} me={me} salonId={location.id} onClose={() => setSel(null)} onChange={load} />}
    </div>
  );
}

function Profile({ phone, d, me, salonId, onClose, onChange }: { phone: string; d: Data; me: string | null; salonId: string; onClose: () => void; onChange: () => Promise<void> }) {
  const appts = d.appts.filter((a) => a.client_phone === phone);
  const calls = d.calls.filter((c) => c.customer_phone === phone);
  const msgs = d.msgs.filter((m) => m.customer_phone === phone);
  const notes = d.notes.filter((n) => n.customer_phone === phone);
  const base: Profile = d.profiles[phone] ?? { customer_phone: phone, customer_name: appts.find((a) => a.client_name)?.client_name ?? "", email: "", preferred_language: "", preferred_staff_id: null, tags: [], notes: "", ai_enabled: true };
  const [p, setP] = useState<Profile>(base);
  const [tag, setTag] = useState("");
  const [newNote, setNewNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "call" | "text" | "appt" | "pay" | "note">("all");
  useEffect(() => { setP(base); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phone]);

  const now = new Date().toISOString();
  const kept = appts.filter((a) => a.status !== "cancelled");
  const upcoming = appts.filter((a) => ACTIVE.includes(a.status) && a.starts_at > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = appts.filter((a) => !(ACTIVE.includes(a.status) && a.starts_at > now));
  const staffName = (id: string | null) => d.staff.find((s) => s.id === id)?.name ?? "";
  const counts = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => (x ? ((m[x] = (m[x] ?? 0) + 1), m) : m), {})).sort((a, b) => b[1] - a[1]);
  const suggestedTech = counts(kept.map((a) => staffName(a.staff_id)))[0]?.[0];
  const services = counts(kept.map((a) => a.service_name));
  const value = kept.reduce((s, a) => s + (Number(a.price) || 0), 0);
  const depositDue = appts.filter((a) => ACTIVE.includes(a.status) && (a.deposit_status === "required" || a.deposit_status === "link_sent"));
  const depositPaid = appts.filter((a) => a.deposit_status === "paid").reduce((s, a) => s + a.deposit_cents, 0);

  const save = async (next: Profile) => {
    setP(next); setMsg(null);
    const { error } = await supabase.from("sms_threads").upsert({ salon_id: salonId, customer_phone: phone, customer_name: next.customer_name, email: next.email.trim(), preferred_language: next.preferred_language, preferred_staff_id: next.preferred_staff_id, tags: next.tags, notes: next.notes, ai_enabled: next.ai_enabled, updated_at: new Date().toISOString() }, { onConflict: "salon_id,customer_phone" });
    if (error) setMsg("Couldn't save that change."); else void onChange();
  };
  const addNote = async () => {
    const body = newNote.trim(); if (!body) return;
    const { error } = await supabase.from("customer_notes").insert({ salon_id: salonId, customer_phone: phone, body });
    if (error) { setMsg("Couldn't add that note."); return; }
    setNewNote(""); void onChange();
  };
  const delNote = async (id: string) => { await supabase.from("customer_notes").delete().eq("id", id); void onChange(); };

  type Ev = { k: "call" | "text" | "appt" | "pay" | "note"; at: string; title: string; body?: string; id: string };
  const timeline: Ev[] = [
    ...calls.map((c) => ({ k: "call" as const, at: c.started_at, id: c.id, title: `${c.direction === "outbound" ? "Outgoing" : "Incoming"} call · ${Math.max(1, Math.round(c.duration_secs / 60))} min`, body: c.title || c.summary })),
    ...msgs.map((m) => ({ k: "text" as const, at: m.sent_at, id: m.id, title: m.direction === "inbound" ? "Text from client" : m.sent_by === "staff" ? "Text from team" : "Text from Salon Agent", body: m.body })),
    ...appts.map((a) => ({ k: "appt" as const, at: a.starts_at, id: a.id, title: `${a.service_name} · ${STATUS[a.status]?.label ?? a.status}`, body: [staffName(a.staff_id) && `with ${staffName(a.staff_id)}`, BOOKED_BY[a.source], money(Number(a.price) || 0)].filter(Boolean).join(" · ") })),
    ...appts.filter((a) => a.deposit_status !== "none").map((a) => ({ k: "pay" as const, at: a.starts_at, id: `p${a.id}`, title: `${DEPOSIT[a.deposit_status] ?? a.deposit_status}${a.deposit_cents ? ` · ${money(a.deposit_cents / 100)}` : ""}`, body: a.service_name })),
    ...notes.map((n) => ({ k: "note" as const, at: n.created_at, id: n.id, title: "Team note", body: n.body })),
  ].filter((e) => tab === "all" || e.k === tab).sort((a, b) => b.at.localeCompare(a.at));
  const ICON = { call: Phone, text: MessageSquare, appt: CalendarDays, pay: CreditCard, note: StickyNote };

  const field = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-violet";
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-2xl font-semibold">{p.customer_name || formatUsNumber(phone) || phone}</h2><p className="text-sm text-muted-foreground">{formatUsNumber(phone) || phone}{p.opted_out ? " · Opted out of texts" : ""}</p></div>
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-accent"><X className="size-4" /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`tel:${phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3 text-xs"><Phone className="size-3.5" />Call</a>
          <Link to="/dashboard/messages" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3 text-xs"><MessageSquare className="size-3.5" />Text</Link>
          <Link to="/dashboard/appointments" search={{ new: 1, phone, name: p.customer_name || undefined }} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs text-primary-foreground"><CalendarDays className="size-3.5" />Book appointment</Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Est. booking value", money(value)], ["Visits", String(kept.filter((a) => a.starts_at <= now).length)], ["Upcoming", String(upcoming.length)], ["Deposits", depositDue.length ? `${depositDue.length} due` : depositPaid ? `${money(depositPaid / 100)} paid` : "None"]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-accent/60 p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 font-semibold">{v}</p></div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Name<input className={field} defaultValue={p.customer_name} key={`n${phone}`} onBlur={(e) => e.target.value !== p.customer_name && save({ ...p, customer_name: e.target.value.slice(0, 120) })} /></label>
          <label className="text-xs text-muted-foreground">Email<input type="email" className={field} defaultValue={p.email} key={`e${phone}`} onBlur={(e) => e.target.value !== p.email && save({ ...p, email: e.target.value.slice(0, 200) })} /></label>
          <label className="text-xs text-muted-foreground">Preferred language<select className={field} value={p.preferred_language} onChange={(e) => save({ ...p, preferred_language: e.target.value })}>{["", "English", "Spanish", "Vietnamese", "Korean", "Chinese", "Other"].map((l) => <option key={l} value={l}>{l || "Not set"}</option>)}</select></label>
          <label className="text-xs text-muted-foreground">Preferred technician<select className={field} value={p.preferred_staff_id ?? ""} onChange={(e) => save({ ...p, preferred_staff_id: e.target.value || null })}><option value="">{suggestedTech ? `Not set (usually sees ${suggestedTech})` : "Not set"}</option>{d.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </div>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">Tags</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {p.tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-violet/15 px-2.5 py-1 text-xs text-violet">{t}<button aria-label={`Remove ${t}`} onClick={() => save({ ...p, tags: p.tags.filter((x) => x !== t) })}><X className="size-3" /></button></span>)}
            <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tag.trim() && !p.tags.includes(tag.trim())) { void save({ ...p, tags: [...p.tags, tag.trim().slice(0, 30)] }); setTag(""); } }} placeholder="Add tag + Enter" className="h-8 w-36 rounded-full border border-border bg-background px-3 text-xs outline-none" />
          </div>
        </div>
        <label className="mt-4 block text-xs text-muted-foreground">Client notes (allergies, preferences)<textarea key={`x${phone}`} defaultValue={p.notes} rows={2} onBlur={(e) => e.target.value !== p.notes && save({ ...p, notes: e.target.value.slice(0, 2000) })} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-violet" /></label>
        {msg && <p className="mt-2 text-sm text-coral">{msg}</p>}

        {services.length > 0 && <div className="mt-6"><h3 className="text-sm font-semibold">Services booked</h3><div className="mt-2 flex flex-wrap gap-2">{services.map(([s, n]) => <span key={s} className="rounded-full bg-accent px-3 py-1 text-xs">{s} × {n}</span>)}</div></div>}

        <div className="mt-6"><h3 className="text-sm font-semibold">Upcoming appointments</h3>
          {upcoming.length ? <ul className="mt-2 space-y-2">{upcoming.map((a) => <li key={a.id} className="rounded-xl border border-border p-3 text-sm"><p className="font-medium">{a.service_name}</p><p className="text-xs text-muted-foreground">{when(a.starts_at)}{staffName(a.staff_id) && ` · ${staffName(a.staff_id)}`} · {DEPOSIT[a.deposit_status]}</p></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Nothing booked.</p>}
        </div>
        <div className="mt-6"><h3 className="text-sm font-semibold">Appointment history</h3>
          {past.length ? <ul className="mt-2 space-y-1">{past.map((a) => <li key={a.id} className="flex justify-between gap-3 text-sm"><span>{a.service_name} <span className="text-xs text-muted-foreground">· {when(a.starts_at)}</span></span><span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS[a.status]?.cls)}>{STATUS[a.status]?.label ?? a.status}</span></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">No past visits.</p>}
        </div>

        <div className="mt-8"><h3 className="text-sm font-semibold">Timeline</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">{([["all", "All"], ["call", "Calls"], ["text", "Texts"], ["appt", "Appointments"], ["pay", "Payments"], ["note", "Notes"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn("rounded-full px-3 py-1 text-xs", tab === k ? "bg-primary text-primary-foreground" : "bg-accent")}>{l}</button>)}</div>
          <div className="mt-3 flex gap-2"><input value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add a team note…" maxLength={2000} className={field} /><button onClick={addNote} className="h-10 shrink-0 rounded-xl bg-primary px-4 text-sm text-primary-foreground">Add</button></div>
          {timeline.length ? <ol className="mt-4 space-y-3 border-l border-border pl-5">{timeline.map((e) => { const I = ICON[e.k]; return (
            <li key={e.k + e.id} className="relative"><span className="absolute -left-[31px] grid size-5 place-items-center rounded-full bg-accent"><I className="size-3 text-violet" /></span>
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{e.title}</p><span className="shrink-0 text-xs text-muted-foreground">{when(e.at)}</span></div>
              {e.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{e.body}</p>}
              {e.k === "note" && notes.find((n) => n.id === e.id)?.user_id === me && <button onClick={() => delNote(e.id)} className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-coral"><Trash2 className="size-3" />Delete</button>}
            </li>); })}</ol> : <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>}
        </div>
      </aside>
    </div>
  );
}
