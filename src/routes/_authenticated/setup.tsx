import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Globe, Loader2, Pause, Play, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadOrCreateSalon, saveSalon, saveServices, type Salon, type Service } from "@/lib/salon-data";
import { extractServices, launchSalon } from "@/lib/setup.functions";
import { voices, greeting } from "@/lib/voices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Set up your salon — NailDesk Pro" },
      { name: "description", content: "Tell NailDesk Pro about your salon, pick a receptionist voice and launch." },
      { property: "og:title", content: "Set up your salon — NailDesk Pro" },
      { property: "og:description", content: "Salon details, services, voice and policies in a few minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

const steps = ["Salon", "Services", "Voice", "Policies", "Review"];
const input = "h-11 w-full rounded-2xl border border-border bg-background/60 px-4 text-sm outline-none focus:border-ring";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

function SetupPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const launch = useServerFn(launchSalon);
  const launchKey = useRef<string>(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "");

  useEffect(() => { loadOrCreateSalon().then(({ salon, services }) => { setSalon(salon); setServices(services); }).catch((e) => setErr(e.message)); }, []);

  if (!salon) return <div className="grid min-h-screen place-items-center text-muted-foreground">{err ?? <Loader2 className="size-5 animate-spin" />}</div>;
  const set = (p: Partial<Salon>) => setSalon({ ...salon, ...p });

  async function persist() {
    setSaving(true); setErr(null);
    try {
      await saveSalon(salon!.id, salon!);
      if (step === 1) await saveServices(id, services);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save"); setSaving(false); return false; }
    setSaving(false); return true;
  }
  async function next() {
    if (step === 0 && !salon!.name.trim()) { setErr("Please add your salon name."); return; }
    if (step === 0) {
      const n = normalizeUsNumber(salon!.phone);
      if (!n) { setErr("Please add your salon's current US phone number."); return; }
      salon!.phone = formatUsNumber(n);
      setSalon({ ...salon!, phone: formatUsNumber(n) });
    }
    if (await persist()) setStep((s) => Math.min(s + 1, 4));
  }
  async function doLaunch() {
    setSaving(true);
    try { await saveServices(salon!.id, services); const r = await launch({ data: { idempotencyKey: launchKey.current } }); if (r.status === "failed") { launchKey.current = crypto.randomUUID(); throw new Error(r.error ?? "Launch failed"); } nav({ to: "/account" }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Launch failed"); setSaving(false); }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">NailDesk Pro</Link>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/account" className="hover:text-foreground">My status</Link>
            <button onClick={() => supabase.auth.signOut().then(() => nav({ to: "/" }))} className="hover:text-foreground">Sign out</button>
          </div>
        </div>

        <ol className="mt-10 flex gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex-1">
              <button onClick={() => i < step && setStep(i)} className="w-full text-left">
                <div className={cn("h-1 rounded-full", i <= step ? "bg-brand" : "bg-muted")} />
                <span className={cn("mt-2 block text-xs", i === step ? "text-foreground" : "text-muted-foreground")}>{i + 1}. {s}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="glass mt-8 rounded-[28px] p-6 md:p-10">
          {step === 0 && <SalonStep salon={salon} set={set} />}
          {step === 1 && <ServicesStep services={services} setServices={setServices} website={salon.website} />}
          {step === 2 && <VoiceStep salon={salon} set={set} />}
          {step === 3 && <PolicyStep salon={salon} set={set} />}
          {step === 4 && <ReviewStep salon={salon} services={services} />}

          {err && <p className="mt-6 text-sm text-destructive">{err}</p>}
          <div className="mt-10 flex items-center justify-between">
            <button disabled={step === 0} onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-0"><ArrowLeft className="size-4" />Back</button>
            {step < 4 ? (
              <button onClick={next} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}Save & continue <ArrowRight className="size-4" />
              </button>
            ) : (
              <button onClick={doLaunch} disabled={saving} className="bg-brand inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}Launch my receptionist
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function H({ t, d }: { t: string; d: string }) {
  return <div className="mb-8"><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t}</h1><p className="mt-2 text-muted-foreground">{d}</p></div>;
}

function SalonStep({ salon, set }: { salon: Salon; set: (p: Partial<Salon>) => void }) {
  const langs = ["English", "Vietnamese", "Spanish", "Chinese", "Korean"];
  const f = (k: keyof Salon, l: string, ph = "") => (
    <div><label className={label}>{l}</label><input className={input} placeholder={ph} value={String(salon[k] ?? "")} onChange={(e) => set({ [k]: e.target.value } as Partial<Salon>)} /></div>
  );
  return (
    <>
      <H t="Tell NailDesk about your salon" d="This is what your receptionist will know when customers call or text." />
      <div className="grid gap-4 md:grid-cols-2">
        {f("name", "Salon name", "Modern Nails")}
        {f("contact_name", "Manager / contact person")}
        <div>
          {f("phone", "Current salon phone number", "(555) 123-4567")}
          <p className="mt-1.5 text-xs text-muted-foreground">Your customers can keep the number they already know. NailDesk will help connect it.</p>
        </div>
        {f("website", "Website", "modernnails.com")}
        <div className="md:col-span-2">{f("address", "Address")}</div>
        <div className="md:col-span-2">
          <label className={label}>Hours</label>
          <textarea className={cn(input, "h-24 py-3")} placeholder="Mon–Sat 9:30am–7pm, Sun 10am–5pm" value={salon.hours} onChange={(e) => set({ hours: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Languages</label>
          <div className="flex flex-wrap gap-2">
            {langs.map((l) => {
              const on = salon.languages.includes(l);
              return <button key={l} type="button" onClick={() => set({ languages: on ? salon.languages.filter((x) => x !== l) : [...salon.languages, l] })} className={cn("rounded-full border px-4 py-2 text-sm", on ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{l}</button>;
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ServicesStep({ services, setServices, website }: { services: Service[]; setServices: (s: Service[]) => void; website: string }) {
  const extract = useServerFn(extractServices);
  const [url, setUrl] = useState(website);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(p: { kind: "website" | "file" | "text"; url?: string; fileBase64?: string; mediaType?: string }, kind: string) {
    setBusy(kind); setNote(null);
    try {
      const r = await extract({ data: p });
      if (r.error) setNote(r.error);
      else if (!r.services.length) setNote("No services found — try another file or add them below.");
      else { setServices(r.services); setNote(`Imported ${r.services.length} services. Check them below.`); }
    } catch (e) { setNote(e instanceof Error ? e.message : "Import failed"); }
    setBusy(null);
  }
  async function onFile(f: File) {
    if (f.size > 10_000_000) { setNote("Please use a file under 10 MB."); return; }
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const mt = f.type || (f.name.endsWith(".csv") ? "text/csv" : "text/plain");
    run({ kind: "file", fileBase64: btoa(bin), mediaType: mt }, "file");
  }
  const upd = (i: number, p: Partial<Service>) => setServices(services.map((s, j) => (j === i ? { ...s, ...p } : s)));

  return (
    <>
      <H t="Your services & prices" d="Upload your menu, import from your website, or edit the list by hand." />
      <div className="grid gap-3 md:grid-cols-2">
        <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="rounded-2xl border border-dashed border-border p-5 text-left hover:bg-accent">
          {busy === "file" ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          <div className="mt-3 font-medium">Upload a menu</div>
          <div className="text-sm text-muted-foreground">PDF, photo, CSV or price list</div>
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div className="rounded-2xl border border-border p-5">
          <Globe className="size-5" />
          <div className="mt-3 font-medium">Import from website</div>
          <div className="mt-2 flex gap-2">
            <input className={cn(input, "h-10")} placeholder="modernnails.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button disabled={!!busy || !url} onClick={() => run({ kind: "website", url }, "web")} className="rounded-full bg-primary px-4 text-sm text-primary-foreground disabled:opacity-60">{busy === "web" ? <Loader2 className="size-4 animate-spin" /> : "Import"}</button>
          </div>
        </div>
      </div>
      {busy && <p className="mt-4 text-sm text-muted-foreground">Reading your menu… this can take up to a minute.</p>}
      {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}

      <div className="mt-8 space-y-2">
        <div className="grid grid-cols-[1fr_80px_80px_70px_32px] gap-2 px-1 text-xs text-muted-foreground"><span>Service</span><span>Price $</span><span>Minutes</span><span>Add-on</span><span /></div>
        {services.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_70px_32px] items-center gap-2">
            <input className={cn(input, "h-10")} value={s.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <input className={cn(input, "h-10 px-3")} type="number" value={s.price} onChange={(e) => upd(i, { price: Number(e.target.value) })} />
            <input className={cn(input, "h-10 px-3")} type="number" value={s.minutes} onChange={(e) => upd(i, { minutes: Number(e.target.value) })} />
            <input type="checkbox" className="size-4 justify-self-center" checked={s.is_addon} onChange={(e) => upd(i, { is_addon: e.target.checked })} />
            <button onClick={() => setServices(services.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground" aria-label="Remove"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <button onClick={() => setServices([...services, { name: "", price: 0, minutes: 30, is_addon: false }])} className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Plus className="size-4" />Add service</button>
      </div>
    </>
  );
}

function VoiceStep({ salon, set }: { salon: Salon; set: (p: Partial<Salon>) => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<string, string>());

  useEffect(() => () => audio.current?.pause(), []);

  async function play(id: string) {
    if (playing === id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause(); setMsg(null);
    const key = `${id}|${salon.name}`;
    let src = cache.current.get(key);
    if (!src) {
      setLoading(id);
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/voice-preview", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify({ voice: id, salon: salon.name }) });
      setLoading(null);
      if (!res.ok) { setMsg(await res.text()); return; }
      src = URL.createObjectURL(await res.blob());
      cache.current.set(key, src);
    }
    const a = new Audio(src); audio.current = a;
    a.onended = () => setPlaying(null);
    a.play(); setPlaying(id);
  }

  return (
    <>
      <H t="Choose your receptionist" d={`Press play to hear: "${greeting(salon.name)}"`} />
      <div className="grid gap-3 sm:grid-cols-2">
        {voices.map((v) => {
          const on = salon.voice === v.id;
          return (
            <div key={v.id} onClick={() => set({ voice: v.id })} className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition", on ? "border-ring bg-accent" : "border-border hover:bg-accent/50")}>
              <button onClick={(e) => { e.stopPropagation(); play(v.id); }} className="bg-brand grid size-11 shrink-0 place-items-center rounded-full text-primary-foreground" aria-label={`Play ${v.name}`}>
                {loading === v.id ? <Loader2 className="size-4 animate-spin" /> : playing === v.id ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <div className="flex-1"><div className="font-medium">{v.name}</div><div className="text-sm text-muted-foreground">{v.vibe}</div></div>
              {on && <Check className="size-5 text-success" />}
            </div>
          );
        })}
      </div>
      {msg && <p className="mt-4 text-sm text-muted-foreground">{msg}</p>}
    </>
  );
}

function PolicyStep({ salon, set }: { salon: Salon; set: (p: Partial<Salon>) => void }) {
  return (
    <>
      <H t="Your salon policies" d="So NailDesk Pro answers the same way you would." />
      <div className="grid gap-4">
        <div><label className={label}>Deposits</label><input className={input} placeholder="e.g. $20 deposit for full sets" value={salon.deposit_policy} onChange={(e) => set({ deposit_policy: e.target.value })} /></div>
        <div><label className={label}>Cancellations</label><input className={input} placeholder="e.g. 24 hours notice please" value={salon.cancellation_policy} onChange={(e) => set({ cancellation_policy: e.target.value })} /></div>
        <div><label className={label}>Booking app you use</label><input className={input} placeholder="e.g. Square, Fresha, Booksy, or none" value={salon.booking_app} onChange={(e) => set({ booking_app: e.target.value })} /></div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4" checked={salon.walk_ins} onChange={(e) => set({ walk_ins: e.target.checked })} />We accept walk-ins</label>
        <div>
          <label className={label}>How would you like to finish setup?</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {([["online", "Online, myself"], ["phone", "By phone with NailDesk Pro"], ["concierge", "Have your team do it"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => set({ setup_method: k })} className={cn("rounded-2xl border p-3 text-sm", salon.setup_method === k ? "border-ring bg-accent" : "border-border text-muted-foreground")}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ReviewStep({ salon, services }: { salon: Salon; services: Service[] }) {
  const v = voices.find((x) => x.id === salon.voice);
  const rows: [string, string][] = [
    ["Salon", salon.name], ["Phone", salon.phone], ["Address", salon.address], ["Hours", salon.hours],
    ["Languages", salon.languages.join(", ")], ["Receptionist", v ? `${v.name} — ${v.vibe}` : ""],
    ["Deposits", salon.deposit_policy], ["Cancellations", salon.cancellation_policy],
    ["Walk-ins", salon.walk_ins ? "Yes" : "No"], ["Booking app", salon.booking_app],
  ];
  return (
    <>
      <H t="Review & launch" d="Everything look right? You can still change it later." />
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[140px_1fr]">
        {rows.map(([k, val]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{val || "—"}</dd></Fragment>)}
        <dt className="text-muted-foreground">Services</dt>
        <dd>{services.filter((s) => s.name).map((s) => `${s.name} ($${s.price}, ${s.minutes}m)`).join(" · ") || "—"}</dd>
      </dl>
    </>
  );
}
