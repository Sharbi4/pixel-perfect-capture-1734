import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Bot, CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, MessageSquare, Phone, Plus, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { sendApptConfirmation, sendText } from "@/lib/texting.functions";
import { formatUsNumber } from "@/lib/phone-format";
import { cn } from "@/lib/utils";
import { addDays, fmtDay, fmtTime, localDate, openSlots, weekday, zoned } from "@/lib/availability";
import { ACTIVE, SOURCE, STATUS, loadAppts, loadBasics, loadTimeOff, minutesOf, BOOKED_BY, DEPOSIT, PROVIDER, type Appt, type SalonRules, type Service, type Staff, type WaitItem } from "@/lib/appointments";

const Search_ = z.object({ new: z.coerce.number().optional(), phone: z.string().max(30).optional(), name: z.string().max(120).optional(), call: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/dashboard/appointments")({
  validateSearch: (s) => Search_.parse(s),
  head: () => ({ meta: [{ title: "Appointments — Salon Pro Agent" }, { name: "description", content: "Your salon calendar: bookings by staff and by your Salon Agent." }, { property: "og:title", content: "Appointments — Salon Pro Agent" }, { property: "og:description", content: "Salon calendar with staff view, list and waitlist." }, { name: "robots", content: "noindex" }] }),
  component: AppointmentsPage,
});

type Init = { phone?: string | undefined; name?: string | undefined; call?: string | undefined; start?: string | undefined; staff?: string | undefined };
type View = "day" | "week" | "month" | "staff";
const DAY_START = 8 * 60, DAY_END = 21 * 60, PX = 1.1; // px per minute

function AppointmentsPage() {
  const { location } = useActiveLocation();
  const search = Route.useSearch();
  const [basics, setBasics] = useState<{ rules: SalonRules; staff: Staff[]; services: Service[] } | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [tab, setTab] = useState<"calendar" | "list" | "waitlist">("calendar");
  const [view, setView] = useState<View>("staff");
  const [date, setDate] = useState<string>("");
  const [f, setF] = useState({ staff: "", service: "", status: "", source: "" });
  const [open, setOpen] = useState<Appt | null>(null);
  const [creating, setCreating] = useState<null | Init>(null);
  const tz = basics?.rules.timezone ?? "America/Phoenix";

  useEffect(() => { void loadBasics(location.id).then((b) => { setBasics(b); setDate((d) => d || localDate(new Date(), b.rules.timezone)); }); }, [location.id]);
  useEffect(() => { if (search.new) setCreating({ phone: search.phone, name: search.name, call: search.call }); }, [search.new, search.phone, search.name, search.call]);

  const range = useMemo(() => {
    if (!date) return null;
    if (view === "week") { const s = addDays(date, -weekday(date)); return { days: Array.from({ length: 7 }, (_, i) => addDays(s, i)) }; }
    if (view === "month") { const first = `${date.slice(0, 8)}01`; const s = addDays(first, -weekday(first)); return { days: Array.from({ length: 42 }, (_, i) => addDays(s, i)) }; }
    return { days: [date] };
  }, [date, view]);

  const reload = useCallback(async () => {
    if (!range || !basics) return;
    const from = zoned(range.days[0]!, 0, tz).toISOString();
    const to = zoned(addDays(range.days[range.days.length - 1]!, 1), 0, tz).toISOString();
    setAppts(await loadAppts(location.id, from, to));
  }, [range, basics, tz, location.id]);
  useEffect(() => { void reload(); }, [reload]);

  const shown = appts.filter((a) => (!f.staff || a.staff_id === f.staff) && (!f.service || a.service_id === f.service) && (!f.status || a.status === f.status) && (!f.source || a.source === f.source) && (f.status || a.status !== "cancelled"));
  const staffName = (id: string | null) => basics?.staff.find((s) => s.id === id)?.name ?? "Any";
  const step = (n: number) => setDate((d) => (view === "month" ? shiftMonth(d, n) : addDays(d, view === "week" ? 7 * n : n)));
  const title = date ? (view === "month" ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : view === "week" ? `Week of ${new Date(`${range!.days[0]}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })) : "";

  if (!basics) return <div className="grid place-items-center py-24"><Loader2 className="size-5 animate-spin" /></div>;
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{location.name || "Your salon"}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Appointments</h1>
          <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs"><span className="size-1.5 rounded-full bg-success" />Salon Pro Scheduling</span>
        </div>
        <button onClick={() => setCreating({})} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> New Appointment</button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["calendar", "list", "waitlist"] as const).map((t) => <Pill key={t} on={tab === t} onClick={() => setTab(t)}>{t[0]!.toUpperCase() + t.slice(1)}</Pill>)}
      </div>

      {!basics.staff.length && (
        <div className="glass mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5 text-sm">
          <span>Add your technicians and their hours so your Salon Agent can book real open times.</span>
          <Link to="/dashboard/team" className="rounded-full bg-primary px-4 py-2 text-primary-foreground">Set up team & hours</Link>
        </div>
      )}

      {tab === "calendar" && <>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => step(-1)} aria-label="Previous" className="grid size-9 place-items-center rounded-full bg-accent"><ChevronLeft className="size-4" /></button>
          <span className="min-w-48 text-center font-medium">{title}</span>
          <button onClick={() => step(1)} aria-label="Next" className="grid size-9 place-items-center rounded-full bg-accent"><ChevronRight className="size-4" /></button>
          <span className="mx-1 h-6 w-px bg-border" />
          <Pill on={false} onClick={() => { setDate(localDate(new Date(), tz)); setView("staff"); }}>Today</Pill>
          <Pill on={view === "day" && date === localDate(new Date(), tz)} onClick={() => { setDate(localDate(new Date(), tz)); setView("day"); }}>Today</Pill>
          {([["day", "Day"], ["week", "Week"], ["month", "Calendar"], ["staff", "By technician"]] as const).map(([v, l]) => <Pill key={v} on={view === v && !(v === "day" && date === localDate(new Date(), tz))} onClick={() => setView(v)}>{l}</Pill>)}
        </div>
        <Filters f={f} setF={setF} staff={basics.staff} services={basics.services} />
        <div className="glass mt-4 overflow-x-auto rounded-[28px]">
          {view === "month" ? <MonthGrid days={range!.days} month={date.slice(0, 7)} appts={shown} tz={tz} onDay={(d) => { setDate(d); setView("staff"); }} />
            : <TimeGrid columns={view === "staff" ? (f.staff ? basics.staff.filter((s) => s.id === f.staff) : basics.staff.filter((s) => s.active)).map((s) => ({ key: s.id, label: s.name, day: date, staff: s }))
              : range!.days.map((d) => ({ key: d, label: new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" }), day: d, staff: null }))}
              appts={shown} tz={tz} staffName={staffName} onOpen={setOpen} onEmpty={(day, m, staff) => setCreating({ start: zoned(day, m, tz).toISOString(), staff })} />}
        </div>
      </>}

      {tab === "list" && <ListTab salonId={location.id} tz={tz} staffName={staffName} onOpen={setOpen} />}
      {tab === "waitlist" && <WaitlistTab salonId={location.id} staff={basics.staff} services={basics.services} />}

      {open && <ApptDrawer a={open} tz={tz} basics={basics} salonId={location.id} onClose={() => setOpen(null)} onChanged={async () => { await reload(); }} />}
      {creating && <NewAppt salonId={location.id} basics={basics} init={creating} onClose={() => setCreating(null)} onSaved={async (d) => { setCreating(null); setDate(d); setView("staff"); await reload(); }} />}
    </div>
  );
}

function shiftMonth(d: string, n: number) { const [y, m] = d.split("-").map(Number) as [number, number]; return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); }

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("rounded-full px-4 py-1.5 text-sm", on ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground")}>{children}</button>;
}
const sel = "h-9 rounded-full bg-accent px-3 text-sm outline-none";

function Filters({ f, setF, staff, services }: { f: Record<string, string>; setF: (x: any) => void; staff: Staff[]; services: Service[] }) {
  const s = (k: string) => (e: React.ChangeEvent<HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <select aria-label="Staff" value={f["staff"]} onChange={s("staff")} className={sel}><option value="">All staff</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select aria-label="Service" value={f["service"]} onChange={s("service")} className={sel}><option value="">All services</option>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select aria-label="Status" value={f["status"]} onChange={s("status")} className={sel}><option value="">Any status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      <select aria-label="Booking source" value={f["source"]} onChange={s("source")} className={sel}><option value="">Any source</option>{Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    </div>
  );
}

function Card({ a, tz, staffName, onOpen, style }: { a: Appt; tz: string; staffName: (id: string | null) => string; onOpen: (a: Appt) => void; style?: React.CSSProperties }) {
  return (
    <button onClick={() => onOpen(a)} style={style} className={cn("absolute inset-x-1 overflow-hidden rounded-xl border border-border bg-surface px-2.5 py-1.5 text-left text-xs shadow-sm hover:border-violet", a.status === "cancelled" && "opacity-50")}>
      <span className="block truncate font-semibold">{a.client_name || formatUsNumber(a.client_phone) || "Client"}</span>
      <span className="block truncate text-muted-foreground">{a.service_name}</span>
      <span className="block truncate text-muted-foreground">{fmtTime(a.starts_at, tz)} · {minutesOf(a)} min · {staffName(a.staff_id)}</span>
      <span className="mt-1 flex flex-wrap gap-1">
        <span className={cn("rounded-full px-1.5 py-px text-[10px]", STATUS[a.status]?.cls)}>{STATUS[a.status]?.label}</span>
        <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px]", a.source.startsWith("ai") ? "bg-violet/20 text-violet" : "bg-accent text-muted-foreground")}>{a.source.startsWith("ai") && <Bot className="size-2.5" />}{BOOKED_BY[a.source]}</span>
        {a.text_confirmed && <span className="rounded-full bg-success/15 px-1.5 py-px text-[10px] text-success">✓ Confirmed</span>}
        {a.deposit_status !== "none" && <span className={cn("rounded-full px-1.5 py-px text-[10px]", a.deposit_status === "paid" ? "bg-success/15 text-success" : "bg-coral/15 text-coral")}>{DEPOSIT[a.deposit_status]}</span>}
      </span>
    </button>
  );
}

function TimeGrid({ columns, appts, tz, staffName, onOpen, onEmpty }: {
  columns: { key: string; label: string; day: string; staff: Staff | null }[]; appts: Appt[]; tz: string; staffName: (id: string | null) => string;
  onOpen: (a: Appt) => void; onEmpty: (day: string, minutes: number, staff?: string) => void;
}) {
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);
  if (!columns.length) return <p className="p-10 text-center text-sm text-muted-foreground">No technicians yet. Add your team to see the staff view.</p>;
  return (
    <div className="flex min-w-max">
      <div className="w-14 shrink-0 pt-10">{hours.map((h) => <div key={h} style={{ height: 60 * PX }} className="pr-2 text-right text-[11px] text-muted-foreground">{fmtHour(h)}</div>)}</div>
      {columns.map((c) => {
        const mine = appts.filter((a) => localDate(new Date(a.starts_at), tz) === c.day && (!c.staff || a.staff_id === c.staff.id));
        const work = c.staff?.hours[String(weekday(c.day))] ?? [];
        return (
          <div key={c.key} className="w-48 shrink-0 border-l border-border">
            <div className="h-10 truncate border-b border-border px-3 py-2.5 text-sm font-medium">{c.label}</div>
            <div className="relative" style={{ height: (DAY_END - DAY_START) * PX }}
              onClick={(e) => { if (e.target !== e.currentTarget) return; const y = e.nativeEvent.offsetY / PX + DAY_START; onEmpty(c.day, Math.floor(y / 15) * 15, c.staff?.id); }}>
              {hours.map((h) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border/50" style={{ top: (h - DAY_START) * PX }} />)}
              {c.staff && work.map(([s, e], i) => <div key={i} className="pointer-events-none absolute inset-x-0 bg-success/[0.04]" style={{ top: (s - DAY_START) * PX, height: (e - s) * PX }} />)}
              {c.staff && !work.length && <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-muted-foreground">Off</div>}
              {mine.map((a) => {
                const top = (minutesOf(a.starts_at, tz) - DAY_START) * PX;
                const h = Math.max(44, (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000 * PX);
                return <Card key={a.id} a={a} tz={tz} staffName={staffName} onOpen={onOpen} style={{ top, height: h }} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
const fmtHour = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}${m < 720 ? "am" : "pm"}`;

function MonthGrid({ days, month, appts, tz, onDay }: { days: string[]; month: string; appts: Appt[]; tz: string; onDay: (d: string) => void }) {
  return (
    <div className="grid min-w-[700px] grid-cols-7">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="border-b border-border px-3 py-2 text-xs text-muted-foreground">{d}</div>)}
      {days.map((d) => {
        const list = appts.filter((a) => localDate(new Date(a.starts_at), tz) === d);
        return (
          <button key={d} onClick={() => onDay(d)} className={cn("min-h-24 border-b border-l border-border p-2 text-left hover:bg-accent", !d.startsWith(month) && "opacity-40")}>
            <span className="text-xs">{Number(d.slice(8))}</span>
            {list.slice(0, 3).map((a) => <span key={a.id} className="mt-1 block truncate rounded bg-violet/15 px-1.5 text-[11px]">{fmtTime(a.starts_at, tz)} {a.client_name || a.service_name}</span>)}
            {list.length > 3 && <span className="mt-1 block text-[11px] text-muted-foreground">+{list.length - 3} more</span>}
          </button>
        );
      })}
    </div>
  );
}

function ListTab({ salonId, tz, staffName, onOpen }: { salonId: string; tz: string; staffName: (id: string | null) => string; onOpen: (a: Appt) => void }) {
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Appt[] | null>(null);
  useEffect(() => {
    const now = new Date();
    const far = new Date(now.getTime() + (when === "upcoming" ? 1 : -1) * 365 * 86_400_000).toISOString();
    void loadAppts(salonId, when === "upcoming" ? now.toISOString() : far, when === "upcoming" ? far : now.toISOString()).then((r) => setRows(when === "past" ? r.reverse() : r));
  }, [salonId, when]);
  const n = q.toLowerCase().trim();
  const list = (rows ?? []).filter((a) => !n || a.client_name.toLowerCase().includes(n) || a.client_phone.includes(n.replace(/\D/g, "") || "~") || a.service_name.toLowerCase().includes(n));
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Pill on={when === "upcoming"} onClick={() => setWhen("upcoming")}>Upcoming</Pill><Pill on={when === "past"} onClick={() => setWhen("past")}>Past</Pill>
        <label className="ml-auto flex h-9 items-center gap-2 rounded-full bg-accent px-3 text-sm"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, phone or service" className="w-56 bg-transparent outline-none" /></label>
      </div>
      <div className="glass mt-3 overflow-x-auto rounded-[28px]">
        {!rows ? <div className="grid place-items-center py-16"><Loader2 className="size-5 animate-spin" /></div> : !list.length ? <p className="py-16 text-center text-sm text-muted-foreground">No appointments.</p> :
          <table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{["When", "Client", "Service", "Technician", "Status", "Source"].map((h) => <th key={h} className="px-5 py-3 font-normal">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{list.map((a) => (
              <tr key={a.id} onClick={() => onOpen(a)} className="cursor-pointer hover:bg-accent">
                <td className="px-5 py-3">{fmtDay(a.starts_at, tz)}<span className="block text-xs text-muted-foreground">{fmtTime(a.starts_at, tz)}</span></td>
                <td className="px-5 py-3">{a.client_name || "—"}<span className="block text-xs text-muted-foreground">{formatUsNumber(a.client_phone)}</span></td>
                <td className="px-5 py-3">{a.service_name}</td><td className="px-5 py-3">{staffName(a.staff_id)}</td>
                <td className="px-5 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS[a.status]?.cls)}>{STATUS[a.status]?.label}</span></td>
                <td className="px-5 py-3 text-muted-foreground">{BOOKED_BY[a.source]}<span className="block text-xs">{minutesOf(a)} min · {a.text_confirmed ? "Confirmed" : "Not confirmed"} · {DEPOSIT[a.deposit_status]}</span></td>
              </tr>))}</tbody></table>}
      </div>
    </div>
  );
}

function WaitlistTab({ salonId, staff, services }: { salonId: string; staff: Staff[]; services: Service[] }) {
  const [rows, setRows] = useState<WaitItem[] | null>(null);
  const [form, setForm] = useState({ client_name: "", client_phone: "", service_name: "", staff_id: "", preferred: "" });
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("waitlist").select("id,client_name,client_phone,service_name,staff_id,preferred,status,created_at").eq("salon_id", salonId).in("status", ["waiting", "contacted"]).order("created_at");
    setRows((data ?? []) as WaitItem[]);
  }, [salonId]);
  useEffect(() => { void load(); }, [load]);
  const add = async () => {
    setErr(null);
    const phone = toE164(form.client_phone);
    if (!form.client_name.trim() || !phone) return setErr("Add a name and a valid phone number.");
    const { error } = await supabase.from("waitlist").insert({ salon_id: salonId, ...form, client_phone: phone, staff_id: form.staff_id || null });
    if (error) return setErr("Couldn't add to the waitlist.");
    setForm({ client_name: "", client_phone: "", service_name: "", staff_id: "", preferred: "" }); void load();
  };
  const setStatus = async (id: string, status: string) => { await supabase.from("waitlist").update({ status }).eq("id", id); void load(); };
  return (
    <div className="mt-4 space-y-4">
      <div className="glass flex flex-wrap items-end gap-2 rounded-3xl p-4">
        <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Client name" className={sel} />
        <input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="Phone" className={sel} />
        <select value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} className={sel}><option value="">Any service</option>{services.map((s) => <option key={s.id}>{s.name}</option>)}</select>
        <select value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} className={sel}><option value="">Any technician</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input value={form.preferred} onChange={(e) => setForm({ ...form, preferred: e.target.value })} placeholder="Preferred days / times" className={cn(sel, "w-52")} />
        <button onClick={add} className="h-9 rounded-full bg-primary px-4 text-sm text-primary-foreground">Add to waitlist</button>
        {err && <p className="w-full text-sm text-coral">{err}</p>}
      </div>
      <div className="glass overflow-hidden rounded-[28px]">
        {!rows ? <div className="grid place-items-center py-16"><Loader2 className="size-5 animate-spin" /></div> : !rows.length ? <p className="py-16 text-center text-sm text-muted-foreground">Nobody is waiting. Your Salon Agent adds clients here when nothing fits.</p> :
          <ul className="divide-y divide-border">{rows.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
              <span className="min-w-0 flex-1"><span className="font-medium">{w.client_name || formatUsNumber(w.client_phone)}</span> <span className="text-muted-foreground">· {w.service_name || "Any service"} · {staff.find((s) => s.id === w.staff_id)?.name ?? "Any technician"}</span>
                {w.preferred && <span className="block text-xs text-muted-foreground">{w.preferred}</span>}</span>
              {w.status === "contacted" && <span className="rounded-full bg-violet/20 px-2 py-0.5 text-xs text-violet">Contacted</span>}
              <a href={`sms:${w.client_phone}`} className="rounded-full bg-accent px-3 py-1.5 text-xs">Text</a>
              <button onClick={() => setStatus(w.id, "booked")} className="rounded-full bg-accent px-3 py-1.5 text-xs">Booked</button>
              <button onClick={() => setStatus(w.id, "removed")} aria-label="Remove" className="text-muted-foreground hover:text-coral"><X className="size-4" /></button>
            </li>))}</ul>}
      </div>
    </div>
  );
}

export function toE164(p: string) { const d = p.replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : ""; }

function SlotPicker({ salonId, basics, serviceId, staffId, day, ignore, value, onChange }: { salonId: string; basics: { rules: SalonRules; staff: Staff[]; services: Service[] }; serviceId: string; staffId: string; day: string; ignore?: string; value: string; onChange: (s: { start: string; staff: string }) => void }) {
  const [slots, setSlots] = useState<{ start: string; staff_id: string; staff_name: string }[] | null>(null);
  useEffect(() => {
    if (!day) return;
    setSlots(null);
    const tz = basics.rules.timezone;
    const from = zoned(day, 0, tz).toISOString(), to = zoned(addDays(day, 1), 0, tz).toISOString();
    void Promise.all([loadAppts(salonId, from, to), loadTimeOff(salonId, from, to)]).then(([a, off]) => {
      const busy = [...a.filter((x) => ACTIVE.includes(x.status) && x.id !== ignore), ...off];
      const svc = basics.services.find((s) => s.id === serviceId);
      setSlots(openSlots({ date: day, staff: basics.staff, busy, minutes: svc?.minutes ?? 30, rules: { ...basics.rules, lead_min: 0 }, now: new Date(), serviceId: serviceId || null, staffId: staffId || null }));
    });
  }, [salonId, basics, serviceId, staffId, day, ignore]);
  if (!slots) return <Loader2 className="size-4 animate-spin" />;
  if (!slots.length) return <p className="text-sm text-muted-foreground">No open times that day{staffId ? " for this technician" : ""}.</p>;
  return (
    <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
      {slots.map((s) => (
        <button key={s.start + s.staff_id} type="button" onClick={() => onChange({ start: s.start, staff: s.staff_id })} className={cn("rounded-full px-3 py-1 text-xs", value === s.start + s.staff_id ? "bg-primary text-primary-foreground" : "bg-accent")}>
          {fmtTime(s.start, basics.rules.timezone)}{staffId ? "" : ` · ${s.staff_name}`}
        </button>))}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-rise absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-6"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-accent"><X className="size-4" /></button></div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
const field = "mt-1 h-10 w-full rounded-xl bg-accent px-3 text-sm outline-none";

function NewAppt({ salonId, basics, init, onClose, onSaved }: { salonId: string; basics: { rules: SalonRules; staff: Staff[]; services: Service[] }; init: Init; onClose: () => void; onSaved: (day: string) => void }) {
  const tz = basics.rules.timezone;
  const [v, setV] = useState({ name: init.name ?? "", phone: init.phone ? formatUsNumber(init.phone) || init.phone : "", service: basics.services[0]?.id ?? "", staff: init.staff ?? "", day: init.start ? localDate(new Date(init.start), tz) : localDate(new Date(), tz), notes: "" });
  const [slot, setSlot] = useState<{ start: string; staff: string } | null>(init.start && init.staff ? { start: init.start, staff: init.staff } : null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr(null);
    const phone = toE164(v.phone);
    const svc = basics.services.find((s) => s.id === v.service);
    if (!svc) return setErr("Pick a service. Add services in setup first if the list is empty.");
    if (!phone) return setErr("Add the client's phone number.");
    if (!slot) return setErr("Pick an open time.");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("appointments").insert({
      salon_id: salonId, staff_id: slot.staff, service_id: svc.id, service_name: svc.name, price: svc.price, client_name: v.name.trim(), client_phone: phone,
      starts_at: slot.start, ends_at: new Date(Date.parse(slot.start) + svc.minutes * 60000).toISOString(), notes: v.notes, call_id: init.call ?? null, source: "staff", created_by: u.user?.id ?? null,
    });
    setBusy(false);
    if (error) return setErr(error.code === "23P01" ? "That time was just taken. Pick another." : "Couldn't save the appointment.");
    onSaved(v.day);
  };
  return (
    <Sheet title="New appointment" onClose={onClose}>
      <label className="block text-sm"><span className="text-xs text-muted-foreground">Client name</span><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={field} /></label>
      <label className="block text-sm"><span className="text-xs text-muted-foreground">Phone</span><input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} inputMode="tel" className={field} /></label>
      <label className="block text-sm"><span className="text-xs text-muted-foreground">Service</span><select value={v.service} onChange={(e) => { setV({ ...v, service: e.target.value }); setSlot(null); }} className={field}>{basics.services.map((s) => <option key={s.id} value={s.id}>{s.name} · ${s.price} · {s.minutes} min</option>)}</select></label>
      <label className="block text-sm"><span className="text-xs text-muted-foreground">Technician</span><select value={v.staff} onChange={(e) => { setV({ ...v, staff: e.target.value }); setSlot(null); }} className={field}><option value="">Any available</option>{basics.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="block text-sm"><span className="text-xs text-muted-foreground">Day</span><input type="date" value={v.day} onChange={(e) => { setV({ ...v, day: e.target.value }); setSlot(null); }} className={field} /></label>
      <div><span className="text-xs text-muted-foreground">Open times</span><div className="mt-2"><SlotPicker salonId={salonId} basics={basics} serviceId={v.service} staffId={v.staff} day={v.day} value={slot ? slot.start + slot.staff : ""} onChange={setSlot} /></div></div>
      <label className="block text-sm"><span className="text-xs text-muted-foreground">Notes</span><textarea value={v.notes} maxLength={2000} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={3} className="mt-1 w-full rounded-xl bg-accent p-3 text-sm outline-none" /></label>
      {err && <p className="text-sm text-coral">{err}</p>}
      <button onClick={save} disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="size-4 animate-spin" />}Book appointment</button>
    </Sheet>
  );
}

function ApptDrawer({ a, tz, basics, salonId, onClose, onChanged }: { a: Appt; tz: string; basics: { rules: SalonRules; staff: Staff[]; services: Service[] }; salonId: string; onClose: () => void; onChanged: () => Promise<void> }) {
  const send = useServerFn(sendText);
  const confirmFn = useServerFn(sendApptConfirmation);
  const [cur, setCur] = useState(a);
  const [notes, setNotes] = useState(a.notes);
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const sendConfirm = async () => {
    setBusy("confirm"); setErr(null); setOk(null);
    const r = await confirmFn({ data: { appointmentId: cur.id } }).catch(() => ({ ok: false, error: "Couldn't send." }));
    setBusy(null);
    if (!r.ok) return setErr(("error" in r && r.error) || "Couldn't send.");
    setCur({ ...cur, text_confirmed: true, confirmation_sent_at: new Date().toISOString() }); setOk("Confirmation sent."); await onChanged();
  };
  const [err, setErr] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [day, setDay] = useState(localDate(new Date(a.starts_at), tz));
  const [staffId, setStaffId] = useState(a.staff_id ?? "");
  const [slot, setSlot] = useState<{ start: string; staff: string } | null>(null);
  const [matches, setMatches] = useState<WaitItem[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const update = async (p: Partial<Appt>) => {
    setErr(null);
    const { error } = await supabase.from("appointments").update({ ...p, updated_at: new Date().toISOString() }).eq("id", cur.id);
    if (error) { setErr(error.code === "23P01" ? "That time overlaps another booking." : "Couldn't save that change."); return false; }
    setCur({ ...cur, ...p }); await onChanged(); return true;
  };
  const cancel = async () => {
    if (!(await update({ status: "cancelled" }))) return;
    const { data } = await supabase.from("waitlist").select("id,client_name,client_phone,service_name,staff_id,preferred,status,created_at").eq("salon_id", salonId).eq("status", "waiting").order("created_at");
    setMatches(((data ?? []) as WaitItem[]).filter((w) => (!w.service_name || w.service_name === cur.service_name) && (!w.staff_id || w.staff_id === cur.staff_id)).slice(0, 5));
  };
  const offer = async (w: WaitItem) => {
    const body = `Good news! An opening for ${cur.service_name} on ${fmtDay(cur.starts_at, tz)} at ${fmtTime(cur.starts_at, tz)} just came up. Reply YES to claim it.`;
    const r = await send({ data: { salonId, to: w.client_phone, body } }).catch(() => ({ ok: false, error: "Couldn't send." }));
    if (!r.ok) return setErr(("error" in r && r.error) || "Couldn't send.");
    await supabase.from("waitlist").update({ status: "contacted" }).eq("id", w.id);
    setSent((s) => ({ ...s, [w.id]: true }));
  };
  const reschedule = async () => {
    if (!slot) return setErr("Pick a new time.");
    const mins = (Date.parse(cur.ends_at) - Date.parse(cur.starts_at)) / 60000;
    if (await update({ starts_at: slot.start, ends_at: new Date(Date.parse(slot.start) + mins * 60000).toISOString(), staff_id: slot.staff })) setMoving(false);
  };
  const active = ACTIVE.includes(cur.status);
  return (
    <Sheet title={cur.client_name || "Appointment"} onClose={onClose}>
      <div className="flex flex-wrap gap-1.5">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs", STATUS[cur.status]?.cls)}>{STATUS[cur.status]?.label}</span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs", cur.source.startsWith("ai") ? "bg-violet/20 text-violet" : "bg-accent")}>{cur.source.startsWith("ai") && <Bot className="size-3" />}{BOOKED_BY[cur.source]} · {SOURCE[cur.source]}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs", cur.text_confirmed ? "bg-success/15 text-success" : "bg-accent text-muted-foreground")}>{cur.text_confirmed ? `✓ Confirmation sent${cur.confirmation_sent_at ? ` ${new Date(cur.confirmation_sent_at).toLocaleDateString()}` : ""}` : "Not confirmed"}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {([["When", `${fmtDay(cur.starts_at, tz)}, ${fmtTime(cur.starts_at, tz)}–${fmtTime(cur.ends_at, tz)}`], ["Service", `${cur.service_name}${cur.price ? ` · $${cur.price}` : ""}`], ["Technician", basics.staff.find((s) => s.id === cur.staff_id)?.name ?? "Any"], ["Phone", formatUsNumber(cur.client_phone) || "—"], ["Duration", `${minutesOf(cur)} min`], ["Calendar", PROVIDER[cur.provider] ?? cur.provider], ["Deposit", `${DEPOSIT[cur.deposit_status]}${cur.deposit_cents ? ` · $${(cur.deposit_cents / 100).toFixed(2)}` : ""}`]] as const).map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-accent px-3 py-2"><dt className="text-[11px] text-muted-foreground">{k}</dt><dd>{v}</dd></div>))}
      </dl>
      <label className="block text-sm"><span className="text-xs text-muted-foreground">Notes</span>
        <textarea value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== cur.notes && update({ notes })} placeholder="Add a note for the team" className="mt-1 w-full rounded-2xl bg-accent p-3 text-sm outline-none" /></label>
      {active && (
        <label className="block text-sm"><span className="text-xs text-muted-foreground">Technician</span>
          <select value={cur.staff_id ?? ""} onChange={(e) => update({ staff_id: e.target.value || null })} className={cn(field, "mt-1 w-full")}>
            <option value="">Unassigned</option>{basics.staff.filter((s) => s.active || s.id === cur.staff_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      )}
      {cur.call_id && <Link to="/dashboard/calls" className="inline-flex items-center gap-1.5 text-sm text-violet hover:underline"><Phone className="size-3.5" /> Open the call this came from</Link>}
      <div className="flex flex-wrap gap-2">
        {cur.client_phone && <><a href={`tel:${cur.client_phone}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm"><Phone className="size-4" />Call</a>
          <Link to="/dashboard/messages" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm"><MessageSquare className="size-4" />Text</Link></>}
        {cur.status === "booked" && <button onClick={() => update({ status: "confirmed" })} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm"><Check className="size-4" />Confirm</button>}
        {active && cur.client_phone && <button disabled={busy === "confirm"} onClick={sendConfirm} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm disabled:opacity-60">{busy === "confirm" ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}{cur.text_confirmed ? "Resend confirmation" : "Send confirmation"}</button>}
        {active && <button disabled title="Connect your salon's own payment account to send deposit links" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm opacity-50">Send payment link</button>}
        {active && <button onClick={() => setMoving((m) => !m)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm"><CalendarDays className="size-4" />Reschedule</button>}
        {active && <button onClick={() => update({ status: "completed" })} className="h-10 rounded-full bg-accent px-4 text-sm">Completed</button>}
        {active && <button onClick={() => update({ status: "no_show" })} className="h-10 rounded-full bg-accent px-4 text-sm">No-show</button>}
        {active && <button onClick={cancel} className="h-10 rounded-full bg-coral/15 px-4 text-sm text-coral">Cancel</button>}
      </div>
      {moving && (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <div className="flex gap-2">
            <input type="date" value={day} onChange={(e) => { setDay(e.target.value); setSlot(null); }} className={cn(field, "mt-0")} />
            <select value={staffId} onChange={(e) => { setStaffId(e.target.value); setSlot(null); }} className={cn(field, "mt-0")}><option value="">Any technician</option>{basics.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
          <SlotPicker salonId={salonId} basics={basics} serviceId={cur.service_id ?? ""} staffId={staffId} day={day} ignore={cur.id} value={slot ? slot.start + slot.staff : ""} onChange={setSlot} />
          <button onClick={reschedule} className="h-10 rounded-full bg-primary px-4 text-sm text-primary-foreground">Move appointment</button>
        </div>
      )}
      {err && <p className="text-sm text-coral">{err}</p>}
      {ok && <p className="text-sm text-success">{ok}</p>}
      {active && <p className="text-xs text-muted-foreground">Payment links need your salon's own payment account connected. That's coming with deposits.</p>}
      {cur.status === "cancelled" && matches.length > 0 && (
        <section className="rounded-2xl border border-violet/40 p-4">
          <h3 className="text-sm font-medium">Fill this opening from your waitlist</h3>
          <ul className="mt-3 space-y-2">{matches.map((w) => (
            <li key={w.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{w.client_name || formatUsNumber(w.client_phone)}<span className="block text-xs text-muted-foreground">{w.preferred || "Any time"}</span></span>
              <button disabled={sent[w.id]} onClick={() => offer(w)} className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{sent[w.id] ? "Texted" : "Text offer"}</button></li>))}</ul>
        </section>
      )}
    </Sheet>
  );
}
