import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Headphones,
  Pause,
  Play,
  Sparkles,
  Upload,
} from "lucide-react";
import { SiteShell, pageMeta, siteButton, siteGhost } from "@/components/site/SiteShell";
import { PlanCards, PricingNotes } from "@/components/site/PlanCards";
import { BrandMark } from "@/components/brand/Brand";
import { Field, inputClass } from "@/components/setup/Fields";
import { previewKey, previewSchema, type PreviewDraft } from "@/lib/checkout-model";
import { getPlan, isTier, setup } from "@/lib/pricing";
import { voices } from "@/lib/voices";
export const Route = createFileRoute("/get-started")({
  head: () =>
    pageMeta(
      "Get started",
      "Meet your next front desk. Explore three plans and personalize a greeting for your salon before checkout.",
    ),
  component: GetStarted,
});
const initial: PreviewDraft = {
  tier: "pro",
  name: "",
  businessType: "Hair Salon",
  website: "",
  services: "",
  voice: "mia",
  step: 0,
};
const steps = ["Choose your plan", "Your business", "Meet your agent"];
function GetStarted() {
  const [draft, setDraft] = useState<PreviewDraft>(initial),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [playing, setPlaying] = useState(false),
    [speech, setSpeech] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const plan = getPlan(draft.tier);
  const voice = voices.find((v) => v.id === draft.voice)!;
  const greeting =
    "Thank you for calling " +
    (draft.name.trim() || "your salon") +
    ". I'm your AI receptionist. How can I help you today?";
  useEffect(() => {
    try {
      const stored = previewSchema.safeParse(
        JSON.parse(localStorage.getItem(previewKey) || "null"),
      );
      const p = new URLSearchParams(window.location.search).get("plan");
      const next = stored.success ? stored.data : initial;
      setDraft(isTier(p) ? { ...next, tier: p, step: 0 } : next);
    } catch {}
    setSpeech("speechSynthesis" in window);
    setReady(true);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(previewKey, JSON.stringify(draft));
      } catch {
        setMessage("This browser cannot save your preview. Keep this tab open while you explore.");
      }
    }
  }, [draft, ready]);
  function update(p: Partial<PreviewDraft>) {
    if (speech) window.speechSynthesis.cancel();
    setPlaying(false);
    setDraft((d) => ({ ...d, ...p }));
  }
  function go(step: number) {
    if (step === 2 && !draft.name.trim()) {
      setMessage("Add your business name to personalize your greeting.");
      return;
    }
    setMessage("");
    update({ step });
    setTimeout(() => title.current?.focus(), 0);
  }
  function listen() {
    if (!speech) return;
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const sample = new SpeechSynthesisUtterance(greeting);
    sample.lang = "en-US";
    sample.rate = draft.voice === "emma" || draft.voice === "grace" ? 0.9 : 1;
    sample.onend = () => setPlaying(false);
    sample.onerror = () => {
      setPlaying(false);
      setMessage(
        "Your browser couldn't play the sample. You can still review your greeting below.",
      );
    };
    setPlaying(true);
    window.speechSynthesis.speak(sample);
  }
  async function importText(file: File | undefined) {
    if (!file) return;
    if (file.size > 100000) {
      setMessage("Choose a text or CSV menu smaller than 100 KB.");
      return;
    }
    if (!/\.(txt|csv)$/i.test(file.name)) {
      setMessage(
        "Use a .txt or .csv menu here. Photo and PDF import is available during paid setup.",
      );
      return;
    }
    try {
      const text = await file.text();
      update({ services: text.slice(0, 6000) });
      setMessage(
        text.length > 6000
          ? "Imported the first 6,000 characters. You can add the rest during setup."
          : "Menu text imported for your setup notes. Review it below.",
      );
    } catch {
      setMessage("We couldn't read that file. You can paste your menu below.");
    }
  }
  return (
    <SiteShell>
      <section className="relative px-5 pb-10 pt-14 sm:px-8 sm:pt-20">
        <div className="mx-auto max-w-7xl">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[.2em] text-muted-foreground">
            <BrandMark className="size-5" />A better day at the salon
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-6xl">
            Your front desk.
            <br />
            <span className="text-gradient">Ready for what's next.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Choose a plan, introduce your business and get a feel for your agent. No account needed
            to explore.
          </p>
          <ol aria-label="Getting started" className="mt-10 grid max-w-3xl grid-cols-3 gap-3">
            {steps.map((s, i) => (
              <li key={s}>
                <button
                  disabled={i > draft.step}
                  aria-current={i === draft.step ? "step" : undefined}
                  onClick={() => go(i)}
                  className="w-full text-left disabled:cursor-default"
                >
                  <span
                    className={
                      "mb-3 block h-1 rounded-full " + (i <= draft.step ? "bg-violet" : "bg-border")
                    }
                  />
                  <span
                    className={
                      "text-xs sm:text-sm " +
                      (i === draft.step ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    {i < draft.step ? <Check className="mr-1 inline size-3" /> : i + 1 + ". "}
                    {s}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <h2
              ref={title}
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight outline-none"
            >
              {steps[draft.step]}
            </h2>
            <span className="text-xs text-muted-foreground">
              {draft.step === 0 ? "Monthly plans · USD" : "Your preview stays in this browser"}
            </span>
          </div>
          {draft.step === 0 ? (
            <>
              <PlanCards selected={draft.tier} onSelect={(tier) => update({ tier })} />
              <PricingNotes />
              <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-border pt-7">
                <p className="text-sm text-muted-foreground">
                  {plan.name} · {plan.price}/month + {setup.price} one-time setup
                </p>
                <button onClick={() => go(1)} disabled={!ready} className={siteButton}>
                  Make it yours
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-[28px] border border-border bg-surface p-6 sm:p-9">
                {draft.step === 1 ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      go(2);
                    }}
                    className="space-y-6"
                  >
                    <div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        A few details will help us shape your front desk. You can refine everything
                        during setup.
                      </p>
                    </div>
                    <Field label="Business name">
                      <input
                        autoComplete="organization"
                        required
                        maxLength={120}
                        className={inputClass}
                        value={draft.name}
                        onChange={(e) => update({ name: e.target.value })}
                        placeholder="Your salon or studio"
                      />
                    </Field>
                    <Field label="Business type">
                      <select
                        className={inputClass}
                        value={draft.businessType}
                        onChange={(e) => update({ businessType: e.target.value })}
                      >
                        {[
                          "Hair Salon",
                          "Nail Salon",
                          "Barber Shop",
                          "Lash/Brow Studio",
                          "Spa",
                          "Beauty Studio",
                          "Other",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Website (optional)">
                      <input
                        autoComplete="url"
                        maxLength={500}
                        className={inputClass}
                        value={draft.website}
                        onChange={(e) => update({ website: e.target.value })}
                        placeholder="yoursalon.com"
                      />
                    </Field>
                    <Field label="Services or menu (optional)">
                      <textarea
                        className={inputClass + " min-h-36 py-3"}
                        maxLength={6000}
                        value={draft.services}
                        onChange={(e) => update({ services: e.target.value })}
                        placeholder="Paste services, prices and appointment lengths."
                      />
                    </Field>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <Upload className="size-4" />
                      Import a text or CSV menu
                      <input
                        type="file"
                        accept=".txt,.csv,text/plain,text/csv"
                        className="sr-only"
                        onChange={(e) => void importText(e.target.files?.[0])}
                      />
                    </label>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Your menu is saved as a draft. Website extraction, PDF import, calendar
                      connection and phone setup happen after checkout.
                    </p>
                    <button className={siteButton}>
                      Preview my greeting
                      <ArrowRight className="size-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Choose a personality for your receptionist.
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {voices.map((v) => (
                        <button
                          key={v.id}
                          aria-pressed={draft.voice === v.id}
                          onClick={() => update({ voice: v.id })}
                          className={
                            "rounded-2xl border p-4 text-left transition " +
                            (draft.voice === v.id
                              ? "border-violet bg-violet/10"
                              : "border-border hover:bg-accent")
                          }
                        >
                          <span className="flex items-center justify-between text-sm font-medium">
                            {v.name}
                            {draft.voice === v.id && <Check className="size-4 text-violet" />}
                          </span>
                          <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                            {v.vibe}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-7 rounded-2xl border border-border bg-background p-6">
                      <p className="text-xs uppercase tracking-[.16em] text-muted-foreground">
                        Your greeting
                      </p>
                      <p className="mt-4 text-xl leading-8 tracking-tight">“{greeting}”</p>
                      <button
                        onClick={listen}
                        disabled={!speech}
                        className={siteGhost + " mt-5 disabled:opacity-40"}
                      >
                        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                        {playing ? "Pause sample" : "Hear a sample"}
                      </button>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        Browser voice sample. Your selected ElevenLabs voice, {voice.name}, is
                        previewed and finalized during setup.
                      </p>
                    </div>
                    <a
                      href={"/checkout?plan=" + draft.tier}
                      className={siteButton + " mt-7 w-full"}
                    >
                      Continue to secure checkout
                      <ArrowRight className="size-4" />
                    </a>
                    <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
                      {plan.price}/month + {setup.price} one-time setup. Review payment details
                      next.
                    </p>
                  </>
                )}
                {message && (
                  <p role="status" className="mt-5 text-sm leading-6 text-muted-foreground">
                    {message}
                  </p>
                )}
                <button
                  onClick={() => go(draft.step - 1)}
                  className="mt-7 flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </button>
              </div>
              <aside className="overflow-hidden rounded-[28px] border border-violet/25 bg-gradient-to-br from-violet/15 via-surface to-surface p-7 sm:p-9">
                <div className="flex items-center justify-between">
                  <BrandMark className="size-12" />
                  <span className="rounded-full border border-border px-3 py-1 text-xs">
                    {plan.name}
                  </span>
                </div>
                <h3 className="mt-8 text-3xl font-semibold leading-tight tracking-tight">
                  More time with clients.
                  <br />
                  <span className="text-muted-foreground">We'll take the call.</span>
                </h3>
                <div className="mt-8 space-y-6">
                  {[
                    [
                      Headphones,
                      "A voice that feels like your salon",
                      "A warm welcome, even when your team is busy.",
                    ],
                    [
                      Sparkles,
                      "Built around your business",
                      "Your services, policies and preferred greeting.",
                    ],
                    [
                      CheckCheck,
                      "A guided path to launch",
                      "Finish your account, connect your number and test your agent.",
                    ],
                  ].map(([Icon, t, d]) => {
                    const I = Icon as typeof Headphones;
                    return (
                      <div key={String(t)} className="flex gap-3">
                        <I className="mt-1 size-5 shrink-0 text-violet" />
                        <div>
                          <p className="text-sm font-medium">{String(t)}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {String(d)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-8 border-t border-border pt-6 text-sm">
                  <p>
                    {plan.minutes.toLocaleString()} voice minutes · {plan.sms.toLocaleString()} SMS
                    segments
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    {plan.price}/month + {setup.price} setup
                  </p>
                  <button onClick={() => go(0)} className="mt-4 text-violet hover:underline">
                    Change plan
                  </button>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
