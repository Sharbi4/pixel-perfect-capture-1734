import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, Fragment, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  loadOrCreateSalon,
  saveSalon,
  saveServices,
  type Salon,
  type Service,
} from "@/lib/salon-data";
import { extractServices, launchSalon } from "@/lib/setup.functions";
import { getPaymentStatus } from "@/lib/square.functions";
import { voices, greeting } from "@/lib/voices";
import { cn } from "@/lib/utils";
import { formatUsNumber, normalizeUsNumber } from "@/lib/phone-format";
import { BrandLogo } from "@/components/brand/Brand";
import { SiteShell, PageHero, siteButton, siteGhost } from "@/components/site/SiteShell";

import { SquareConnect } from "@/components/dashboard/SquareConnect";
import { GoogleCalendarConnect } from "@/components/dashboard/GoogleCalendarConnect";
import { readOnboarding, mergeServiceProposal, type Onboarding } from "@/lib/onboarding-model";
import { saveOnboarding, selectNativeCalendar } from "@/lib/onboarding.functions";
export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Set up your salon — Salon Pro Agent" },
      {
        name: "description",
        content: "Tell Salon Pro Agent about your salon, pick a receptionist voice and launch.",
      },
      { property: "og:title", content: "Set up your salon — Salon Pro Agent" },
      {
        property: "og:description",
        content: "Salon details, services, voice and policies in a few minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

const steps = ["Business", "Calendar", "Services", "Voice", "Policies", "Review"];
const input =
  "h-11 w-full rounded-2xl border border-border bg-background/60 px-4 text-sm outline-none focus:border-ring";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";

function SetupPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<Onboarding>(readOnboarding(null));
  const selectNative = useServerFn(selectNativeCalendar);
  const refreshConnection = useCallback(() => {
    void loadOrCreateSalon()
      .then((r) =>
        setSalon((current) =>
          current ? { ...current, booking_provider: r.salon.booking_provider } : r.salon,
        ),
      )
      .catch((e) => setErr(e.message));
  }, []);
  const saveProgress = useServerFn(saveOnboarding);
  const reloadServices = useCallback(() => {
    void loadOrCreateSalon()
      .then((r) => setServices(r.services))
      .catch((e) => setErr(e.message));
  }, []);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const launch = useServerFn(launchSalon);
  const launchKey = useRef<string>(crypto.randomUUID());
  const paymentStatus = useServerFn(getPaymentStatus);
  const [paid, setPaid] = useState<boolean | null>(null);

  useEffect(() => {
    loadOrCreateSalon()
      .then(({ salon, services }) => {
        // Prefill the paid customer's preview, but do not publish it as agent knowledge until saved.
        const d = salon.setup_draft as {
          business?: { name?: string; website?: string };
          receptionist?: { voice?: string };
        } | null;
        if (!salon.name && d?.business) {
          salon.name = d.business.name || "";
          salon.website = d.business.website || "";
          salon.voice = d.receptionist?.voice || salon.voice;
        }
        const progress = readOnboarding(salon.setup_draft);
        setPreferences(progress);
        setStep(progress.step);
        setSalon(salon);
        setServices(services);
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      paymentStatus()
        .then((r) => {
          if (!cancelled) setPaid(r.paid);
        })
        .catch(() => {
          if (!cancelled) setPaid(false);
        });
    check();
    // Poll while a checkout is in flight (e.g. just returned from Square).
    const t = setInterval(() => {
      if (!cancelled) check();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [paymentStatus]);

  if (!salon || paid === null)
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        {err ?? <Loader2 className="size-5 animate-spin" />}
      </div>
    );
  if (!paid) return <PayGate />;
  const set = (p: Partial<Salon>) => setSalon({ ...salon, ...p });

  async function persist() {
    setSaving(true);
    setErr(null);
    try {
      await saveSalon(salon!.id, salon!);
      if (step === 2) await saveServices(salon!.id, services);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
      setSaving(false);
      return false;
    }
    setSaving(false);
    return true;
  }
  async function next() {
    if (step === 0 && !salon!.name.trim()) {
      setErr("Please add your salon name.");
      return;
    }
    if (step === 0 && (!salon!.address.trim() || !salon!.hours.trim())) {
      setErr("Add your business address and hours so your receptionist can answer accurately.");
      return;
    }
    if (step === 0) {
      const n = normalizeUsNumber(salon!.phone);
      if (!n && preferences.phoneIntent !== "new") {
        setErr("Please add your salon's current US phone number.");
        return;
      }
      if (n) {
        salon!.phone = formatUsNumber(n);
        setSalon({ ...salon!, phone: formatUsNumber(n) });
      }
      if (preferences.phoneIntent === "new" && !/^[2-9][0-9]{2}$/.test(preferences.areaCode)) {
        setErr("Choose a three-digit US area code for your new number.");
        return;
      }
    }
    if (
      step === 2 &&
      (!services.length ||
        services.some(
          (s) =>
            !s.name.trim() ||
            !Number.isFinite(s.price) ||
            s.price < 0 ||
            !Number.isFinite(s.minutes) ||
            s.minutes <= 0,
        ))
    ) {
      setErr("Add at least one service with a name, valid price and duration before continuing.");
      return;
    }
    if (await persist()) {
      try {
        const nextStep = Math.min(step + 1, 5);
        await saveProgress({ data: { ...preferences, step: nextStep } });
        setStep(nextStep);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not save your progress.");
      }
    }
  }
  async function doLaunch() {
    setSaving(true);
    try {
      await saveSalon(salon!.id, salon!);
      await saveServices(salon!.id, services);
      await saveProgress({ data: { ...preferences, step: 5 } });
      const r = await launch({ data: { idempotencyKey: launchKey.current } });
      if (r.status === "failed") {
        launchKey.current = crypto.randomUUID();
        throw new Error(r.error ?? "Launch failed");
      }
      nav({ to: "/account" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Launch failed");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <BrandLogo />
          <div className="flex gap-4 text-sm text-muted-foreground">
            <button
              disabled={saving}
              onClick={async () => {
                if (await persist()) {
                  try {
                    await saveProgress({ data: { ...preferences, step } });
                    nav({ to: "/dashboard" });
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }
              }}
            >
              Save & finish later
            </button>
            <Link to="/account" className="hover:text-foreground">
              My status
            </Link>
            <button
              onClick={() => supabase.auth.signOut().then(() => nav({ to: "/" }))}
              className="hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-xs uppercase tracking-[.18em] text-muted-foreground">
            Your launch studio
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Let’s make it yours.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Build a front desk that knows your services, speaks in your voice and welcomes every
            client.
          </p>
        </div>
        <ol className="mt-10 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {steps.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                disabled={saving || i > step}
                aria-current={i === step ? "step" : undefined}
                onClick={() => i < step && setStep(i)}
                className="w-full text-left"
              >
                <div className={cn("h-1 rounded-full", i <= step ? "bg-brand" : "bg-muted")} />
                <span
                  className={cn(
                    "mt-2 block text-xs",
                    i === step ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {i + 1}. {s}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="glass mt-8 rounded-[28px] p-6 md:p-10">
          {step === 0 && (
            <>
              <SalonStep salon={salon} set={set} />
              <fieldset className="mt-6">
                <legend className="text-sm font-medium">Your phone setup</legend>
                <select
                  aria-label="Phone setup"
                  className={cn(input, "mt-3")}
                  value={preferences.phoneIntent}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      phoneIntent: e.target.value as Onboarding["phoneIntent"],
                    })
                  }
                >
                  <option value="forward">Keep my number and forward calls</option>
                  <option value="new">Reserve a new dedicated number</option>
                  <option value="port">Request a managed number transfer</option>
                </select>
                {preferences.phoneIntent === "new" && (
                  <input
                    className={cn(input, "mt-3")}
                    aria-label="Preferred US area code"
                    placeholder="Preferred US area code, e.g. 520"
                    inputMode="numeric"
                    maxLength={3}
                    value={preferences.areaCode}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        areaCode: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                )}
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Reserve and test your agent number after building your receptionist. Forwarding
                  keeps your existing service. Porting requires an eligibility check and coordinated
                  transfer; keep your current carrier active.
                </p>
              </fieldset>
            </>
          )}
          {step === 1 && (
            <>
              <H
                t="Bring your calendar along"
                d="Connect the account that holds your appointments. Authorizing access is separate from verifying a successful test booking."
              />
              <p className="text-sm leading-6 text-muted-foreground">
                Choose one booking source. Connecting another provider changes the active source.
                You can continue and return here later; test availability and a booking before
                forwarding client calls.
              </p>
              <p className="mt-4 text-sm font-medium">
                Selected booking source:{" "}
                {salon.booking_provider === "salon_pro"
                  ? "Salon Pro Scheduling"
                  : salon.booking_provider === "square"
                    ? "Square Appointments"
                    : salon.booking_provider === "google"
                      ? "Google Calendar"
                      : salon.booking_provider}
                . Connection and a test booking still need to be confirmed.
              </p>
              <SquareConnect
                salonId={salon.id}
                canEdit
                onChanged={refreshConnection}
                returnTo="/setup"
                beforeAction={async () => {
                  await saveProgress({ data: { ...preferences, step: 1 } });
                }}
                showImport={false}
              />
              <GoogleCalendarConnect salonId={salon.id} canEdit onChanged={refreshConnection} />
              <div className="mt-6 rounded-2xl border border-border p-5">
                <h3 className="font-medium">Need a calendar, or use a different provider?</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Salon Pro Scheduling is included with Pro and Premier, or available for $79/month
                  with Essential. Configure team availability in your dashboard with your launch
                  team. For other platforms, contact support to confirm compatibility. Uploading a
                  menu does not connect a calendar.
                </p>
                <a
                  className="mt-3 inline-block text-sm underline"
                  href="mailto:support@salonagentai.com"
                >
                  Get connection help
                </a>
                <button
                  disabled={saving}
                  className="mt-4 block rounded-full bg-accent px-5 py-3 text-sm"
                  onClick={async () => {
                    setSaving(true);
                    setErr(null);
                    try {
                      await selectNative();
                      refreshConnection();
                    } catch (e) {
                      setErr((e as Error).message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {salon.plan_tier === "essential" && !salon.scheduling_addon
                    ? "Check scheduling add-on access"
                    : "Use Salon Pro Scheduling"}
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <SquareConnect
                salonId={salon.id}
                canEdit
                onChanged={reloadServices}
                returnTo="/setup"
                beforeAction={async () => {
                  await saveServices(salon.id, services);
                  await saveProgress({ data: { ...preferences, step: 2 } });
                }}
              />
              <ServicesStep
                services={services}
                setServices={setServices}
                website={salon.website}
                notes={(salon.setup_draft as { service_notes?: string })?.service_notes || ""}
              />
            </>
          )}
          {step === 3 && <VoiceStep salon={salon} set={set} />}
          {step === 4 && <PolicyStep salon={salon} set={set} />}
          {step === 5 && (
            <>
              <ReviewStep salon={salon} services={services} />
              <p className="mt-6 text-sm leading-6 text-muted-foreground">
                Next: build your receptionist, reserve a number and test calls and bookings.
                Building does not forward client calls or complete a number transfer.
              </p>
            </>
          )}

          {err && <p className="mt-6 text-sm text-destructive">{err}</p>}
          <div className="mt-10 flex items-center justify-between">
            <button
              disabled={step === 0 || saving}
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-0"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            {step < 5 ? (
              <button
                onClick={next}
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}Save & continue{" "}
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                onClick={doLaunch}
                disabled={saving}
                className="bg-brand inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}Build my receptionist
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PayGate() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Welcome to Salon Pro Agent"
        title="Make room for"
        accent="your next chapter."
        body="Explore the plans, personalize your greeting and continue to secure checkout. Your account will be ready for the next step."
      >
        <a href="/get-started" className={siteButton}>
          Get started today
          <ArrowRight className="size-4" />
        </a>
        <a href="/complete-account" className={siteGhost}>
          Already purchased? Finish setup
        </a>
      </PageHero>
    </SiteShell>
  );
}

function H({ t, d }: { t: string; d: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t}</h1>
      <p className="mt-2 text-muted-foreground">{d}</p>
    </div>
  );
}

function SalonStep({ salon, set }: { salon: Salon; set: (p: Partial<Salon>) => void }) {
  const langs = ["English", "Vietnamese", "Spanish", "Chinese", "Korean"];
  const f = (k: keyof Salon, l: string, ph = "") => (
    <div>
      <label className={label}>{l}</label>
      <input
        className={input}
        placeholder={ph}
        value={String(salon[k] ?? "")}
        onChange={(e) => set({ [k]: e.target.value } as Partial<Salon>)}
      />
    </div>
  );
  return (
    <>
      <H
        t="Tell Salon Pro Agent about your salon"
        d="This is what your receptionist will know when customers call or text."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {f("name", "Salon name", "Modern Nails")}
        {f("contact_name", "Manager / contact person")}
        <div>
          {f("phone", "Current salon phone (optional for a new number)", "(555) 123-4567")}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Your customers can keep the number they already know. Salon Pro Agent will help connect
            it.
          </p>
        </div>
        {f("website", "Website", "modernnails.com")}
        <div className="md:col-span-2">{f("address", "Address")}</div>
        <div className="md:col-span-2">
          <label className={label}>Business timezone</label>
          <select
            aria-label="Business timezone"
            className={input}
            value={salon.timezone}
            onChange={(e) => set({ timezone: e.target.value })}
          >
            {[
              "America/New_York",
              "America/Chicago",
              "America/Denver",
              "America/Phoenix",
              "America/Los_Angeles",
              "America/Anchorage",
              "Pacific/Honolulu",
            ].map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Use the same timezone as your connected calendar.
          </p>
        </div>
        <div className="md:col-span-2">
          <label className={label}>Hours</label>
          <textarea
            className={cn(input, "h-24 py-3")}
            placeholder="Mon–Sat 9:30am–7pm, Sun 10am–5pm"
            value={salon.hours}
            onChange={(e) => set({ hours: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Languages</label>
          <div className="flex flex-wrap gap-2">
            {langs.map((l) => {
              const on = salon.languages.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() =>
                    set({
                      languages: on
                        ? salon.languages.filter((x) => x !== l)
                        : [...salon.languages, l],
                    })
                  }
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm",
                    on
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ServicesStep({
  services,
  setServices,
  website,
  notes,
}: {
  services: Service[];
  setServices: (s: Service[]) => void;
  website: string;
  notes: string;
}) {
  const [proposal, setProposal] = useState<Service[] | null>(null);
  const [menuText, setMenuText] = useState(notes);
  const extract = useServerFn(extractServices);
  const [url, setUrl] = useState(website);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(
    p: {
      kind: "website" | "file" | "text";
      url?: string;
      fileBase64?: string;
      mediaType?: string;
      text?: string;
    },
    kind: string,
  ) {
    setBusy(kind);
    setNote(null);
    try {
      const r = await extract({ data: p });
      if (r.error) setNote(r.error);
      else if (!r.services.length)
        setNote("No services found — try another file or add them below.");
      else {
        setProposal(r.services);
        setNote(`Found ${r.services.length} services. Review the proposal before adding it.`);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Import failed");
    }
    setBusy(null);
  }
  async function onFile(f: File) {
    if (f.size > 10_000_000) {
      setNote("Please use a file under 10 MB.");
      return;
    }
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000)
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const mt =
      f.type ||
      (/\.pdf$/i.test(f.name)
        ? "application/pdf"
        : /\.csv$/i.test(f.name)
          ? "text/csv"
          : "text/plain");
    run({ kind: "file", fileBase64: btoa(bin), mediaType: mt }, "file");
  }
  const upd = (i: number, p: Partial<Service>) =>
    setServices(services.map((s, j) => (j === i ? { ...s, ...p } : s)));

  return (
    <>
      <H
        t="Your services & prices"
        d="Upload your menu, import from your website, or edit the list by hand."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="rounded-2xl border border-dashed border-border p-5 text-left hover:bg-accent"
        >
          {busy === "file" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Upload className="size-5" />
          )}
          <div className="mt-3 font-medium">Upload a menu</div>
          <div className="text-sm text-muted-foreground">PDF, photo, CSV or price list</div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.csv,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <div className="rounded-2xl border border-border p-5">
          <Globe className="size-5" />
          <div className="mt-3 font-medium">Import from website</div>
          <div className="mt-2 flex gap-2">
            <input
              className={cn(input, "h-10")}
              placeholder="modernnails.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              disabled={!!busy || !url}
              onClick={() => run({ kind: "website", url }, "web")}
              className="rounded-full bg-primary px-4 text-sm text-primary-foreground disabled:opacity-60"
            >
              {busy === "web" ? <Loader2 className="size-4 animate-spin" /> : "Import"}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-border p-5">
        <label className={label}>Paste a menu or use your preview notes</label>
        <textarea
          className={cn(input, "h-28 py-3")}
          value={menuText}
          maxLength={6000}
          onChange={(e) => setMenuText(e.target.value)}
        />
        <button
          className="mt-3 rounded-full bg-accent px-5 py-2 text-sm"
          disabled={!!busy || !menuText.trim()}
          onClick={() => run({ kind: "text", text: menuText }, "text")}
        >
          Review services from text
        </button>
      </div>
      {proposal && (
        <section className="mt-5 rounded-2xl border border-violet/40 p-5">
          <h3 className="font-medium">Review imported services</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Matching names update price and duration. Other existing services stay. Remove proposed
            rows you don’t want; edit details after approval.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {proposal.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  {s.name} · $ {s.price} · {s.minutes} min
                </span>
                <button
                  aria-label={"Exclude " + s.name}
                  onClick={() => setProposal(proposal.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
              onClick={() => {
                setServices(mergeServiceProposal(services, proposal));
                setProposal(null);
                setNote("Approved rows added to your draft. Check details, then Save & continue.");
              }}
            >
              Approve proposal
            </button>
            <button onClick={() => setProposal(null)} className="text-sm">
              Discard
            </button>
          </div>
        </section>
      )}
      {busy && (
        <p className="mt-4 text-sm text-muted-foreground">
          Reading your menu… this can take up to a minute.
        </p>
      )}
      {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}

      <div className="mt-8 space-y-2">
        <div className="grid grid-cols-[minmax(100px,1fr)_65px_65px_45px_25px] gap-2 px-1 text-xs text-muted-foreground">
          <span>Service</span>
          <span>Price $</span>
          <span>Minutes</span>
          <span>Add-on</span>
          <span />
        </div>
        {services.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(100px,1fr)_65px_65px_45px_25px] items-center gap-2"
          >
            <input
              className={cn(input, "h-10")}
              value={s.name}
              onChange={(e) => upd(i, { name: e.target.value })}
            />
            <input
              className={cn(input, "h-10 px-3")}
              type="number"
              value={s.price}
              onChange={(e) => upd(i, { price: Number(e.target.value) })}
            />
            <input
              className={cn(input, "h-10 px-3")}
              type="number"
              value={s.minutes}
              onChange={(e) => upd(i, { minutes: Number(e.target.value) })}
            />
            <input
              type="checkbox"
              className="size-4 justify-self-center"
              checked={s.is_addon}
              onChange={(e) => upd(i, { is_addon: e.target.checked })}
            />
            <button
              onClick={() => setServices(services.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setServices([...services, { name: "", price: 0, minutes: 30, is_addon: false }])
          }
          className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-4" />
          Add service
        </button>
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
    if (playing === id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    setMsg(null);
    const key = `${id}|${salon.name}`;
    let src = cache.current.get(key);
    if (!src) {
      setLoading(id);
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/voice-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token}`,
        },
        body: JSON.stringify({ voice: id, salon: salon.name }),
      });
      setLoading(null);
      if (!res.ok) {
        setMsg(await res.text());
        return;
      }
      src = URL.createObjectURL(await res.blob());
      cache.current.set(key, src);
    }
    const a = new Audio(src);
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.play();
    setPlaying(id);
  }

  return (
    <>
      <H t="Choose your receptionist" d={`Press play to hear: "${greeting(salon.name)}"`} />
      <div className="grid gap-3 sm:grid-cols-2">
        {voices.map((v) => {
          const on = salon.voice === v.id;
          return (
            <div
              key={v.id}
              onClick={() => set({ voice: v.id })}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition",
                on ? "border-ring bg-accent" : "border-border hover:bg-accent/50",
              )}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  play(v.id);
                }}
                className="bg-brand grid size-11 shrink-0 place-items-center rounded-full text-primary-foreground"
                aria-label={`Play ${v.name}`}
              >
                {loading === v.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : playing === v.id ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </button>
              <div className="flex-1">
                <div className="font-medium">{v.name}</div>
                <div className="text-sm text-muted-foreground">{v.vibe}</div>
              </div>
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
      <H t="Your salon policies" d="So Salon Pro Agent answers the same way you would." />
      <div className="grid gap-4">
        <div>
          <label className={label}>Deposits</label>
          <input
            className={input}
            placeholder="e.g. $20 deposit for full sets"
            value={salon.deposit_policy}
            onChange={(e) => set({ deposit_policy: e.target.value })}
          />
        </div>
        <div>
          <label className={label}>Cancellations</label>
          <input
            className={input}
            placeholder="e.g. 24 hours notice please"
            value={salon.cancellation_policy}
            onChange={(e) => set({ cancellation_policy: e.target.value })}
          />
        </div>
        <div>
          <label className={label}>Booking app you use</label>
          <input
            className={input}
            placeholder="e.g. Square, Fresha, Booksy, or none"
            value={salon.booking_app}
            onChange={(e) => set({ booking_app: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={salon.walk_ins}
            onChange={(e) => set({ walk_ins: e.target.checked })}
          />
          We accept walk-ins
        </label>
        <div>
          <label className={label}>How would you like to finish setup?</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["online", "Online, myself"],
                ["phone", "By phone with Salon Pro Agent"],
                ["concierge", "Have your team do it"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => set({ setup_method: k })}
                className={cn(
                  "rounded-2xl border p-3 text-sm",
                  salon.setup_method === k
                    ? "border-ring bg-accent"
                    : "border-border text-muted-foreground",
                )}
              >
                {l}
              </button>
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
    ["Salon", salon.name],
    ["Phone", salon.phone],
    ["Address", salon.address],
    ["Hours", salon.hours],
    ["Languages", salon.languages.join(", ")],
    ["Receptionist", v ? `${v.name} — ${v.vibe}` : ""],
    ["Deposits", salon.deposit_policy],
    ["Cancellations", salon.cancellation_policy],
    ["Walk-ins", salon.walk_ins ? "Yes" : "No"],
    ["Booking app", salon.booking_app],
  ];
  return (
    <>
      <H t="Review & launch" d="Everything look right? You can still change it later." />
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[140px_1fr]">
        {rows.map(([k, val]) => (
          <Fragment key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{val || "—"}</dd>
          </Fragment>
        ))}
        <dt className="text-muted-foreground">Services</dt>
        <dd>
          {services
            .filter((s) => s.name)
            .map((s) => `${s.name} ($${s.price}, ${s.minutes}m)`)
            .join(" · ") || "—"}
        </dd>
      </dl>
    </>
  );
}
