import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Phone,
  CalendarDays,
  MessageSquare,
  Play,
  Pause,
  ShieldCheck,
} from "lucide-react";
import { SiteShell, pageMeta, siteButton, siteGhost } from "@/components/site/SiteShell";
import { PlanCards, PricingNotes } from "@/components/site/PlanCards";
import { BrandMark } from "@/components/brand/Brand";
import { Field, inputClass } from "@/components/setup/Fields";
import { previewKey, previewSchema, type PreviewDraft } from "@/lib/checkout-model";
import { getPlan, isTier, setup, schedulingAddon, usageRates } from "@/lib/pricing";
import { voices } from "@/lib/voices";
export const Route = createFileRoute("/get-started")({
  head: () =>
    pageMeta(
      "Meet your new front desk",
      "Personalize your Salon Pro Agent preview, find the right plan and get a guided path to launch.",
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
  phoneIntent: "forward",
  calendarIntent: "unsure",
  addonInterests: [],
};
const steps = ["Your salon", "Your front desk", "Your plan"];
const phoneOptions = [
  {
    id: "forward",
    title: "Keep my number",
    body: "Forward calls to your agent after testing. Your current phone service stays in place.",
  },
  {
    id: "new",
    title: "Start with a new number",
    body: "Choose a local area code during paid setup and reserve an available agent number.",
  },
  {
    id: "port",
    title: "Move my number",
    body: "Start on a temporary number while our team checks portability and coordinates the transfer.",
  },
] as const;
const calendars = [
  ["square", "Square Appointments"],
  ["google", "Google Calendar"],
  ["salon_pro", "I need a booking calendar"],
  ["other", "Another booking platform"],
  ["unsure", "Help me choose"],
] as const;
function GetStarted() {
  const [draft, setDraft] = useState<PreviewDraft>(initial),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [playing, setPlaying] = useState(false),
    [speech, setSpeech] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const plan = getPlan(draft.tier);
  const sample =
    "Thank you for calling " +
    (draft.name.trim() || "your salon") +
    ". I'm your AI receptionist. I can help with services, appointments or a message for the team. How can I help today?";
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(previewKey) || "null");
      const result = previewSchema.safeParse(saved);
      const p = new URLSearchParams(window.location.search).get("plan");
      const restored = result.success ? result.data : initial;
      setDraft({ ...restored, tier: isTier(p) ? p : restored.tier, step: restored.step });
    } catch {}
    setSpeech("speechSynthesis" in window);
    setReady(true);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(previewKey, JSON.stringify(draft));
      } catch {
        setMessage(
          "Browser storage is unavailable. Enable it to carry your preview into checkout.",
        );
      }
  }, [ready, draft]);
  function update(p: Partial<PreviewDraft>) {
    if (speech) window.speechSynthesis.cancel();
    setPlaying(false);
    setDraft((d) => ({ ...d, ...p }));
  }
  function go(step: number) {
    if (step > 0 && !draft.name.trim()) {
      setMessage("Add your salon name so we can personalize your preview.");
      return;
    }
    setMessage("");
    update({ step });
    setTimeout(() => heading.current?.focus(), 0);
  }
  function listen() {
    if (!speech) return;
    window.speechSynthesis.cancel();
    if (playing) {
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(sample);
    u.lang = "en-US";
    u.rate = 0.95;
    u.onend = () => setPlaying(false);
    u.onerror = () => {
      setPlaying(false);
      setMessage("Audio is unavailable in this browser. You can still review your greeting.");
    };
    setPlaying(true);
    window.speechSynthesis.speak(u);
  }
  function interest(value: "scheduling" | "extra_location") {
    update({
      addonInterests: draft.addonInterests.includes(value)
        ? draft.addonInterests.filter((x) => x !== value)
        : [...draft.addonInterests, value],
    });
  }
  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[.18em] text-muted-foreground">
          <BrandMark className="size-5" />
          Meet your next front desk
        </p>
        <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-6xl">
          More time for your clients.
          <br />
          <span className="text-gradient">We'll take the call.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          See how Salon Pro Agent fits your business before you choose a plan. Start with a few
          simple details.
        </p>
        <ol aria-label="Get started progress" className="mt-9 grid max-w-3xl grid-cols-3 gap-3">
          {steps.map((s, i) => (
            <li key={s}>
              <button
                disabled={i > draft.step}
                aria-current={i === draft.step ? "step" : undefined}
                onClick={() => go(i)}
                className="w-full text-left"
              >
                <span
                  className={
                    "mb-3 block h-1 rounded-full " + (i <= draft.step ? "bg-violet" : "bg-border")
                  }
                />
                <span className="text-xs sm:text-sm">
                  {i < draft.step ? <Check className="mr-1 inline size-3" /> : i + 1 + ". "}
                  {s}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <h2
          ref={heading}
          tabIndex={-1}
          className="mt-12 text-2xl font-semibold tracking-tight outline-none"
        >
          {draft.step === 0
            ? "A front desk built around you."
            : draft.step === 1
              ? "Picture a smoother day at " + draft.name + "."
              : "Choose the room you need to grow."}
        </h2>
        {draft.step === 0 ? (
          <div className="mt-7 grid items-start gap-7 lg:grid-cols-[1.1fr_.9fr]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go(1);
              }}
              className="space-y-6 rounded-[28px] border border-border bg-surface p-6 sm:p-9"
            >
              <Field label="Business name">
                <input
                  className={inputClass}
                  value={draft.name}
                  required
                  maxLength={120}
                  autoComplete="organization"
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Your salon or studio"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
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
                    className={inputClass}
                    value={draft.website}
                    autoComplete="url"
                    maxLength={500}
                    onChange={(e) => update({ website: e.target.value })}
                    placeholder="yoursalon.com"
                  />
                </Field>
              </div>
              <Field label="Where do you manage appointments?">
                <select
                  className={inputClass}
                  value={draft.calendarIntent}
                  onChange={(e) =>
                    update({ calendarIntent: e.target.value as PreviewDraft["calendarIntent"] })
                  }
                >
                  {calendars.map(([id, text]) => (
                    <option key={id} value={id}>
                      {text}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-xs leading-5 text-muted-foreground">
                Just your preference for now. You’ll authorize your own calendar after checkout.
                Google Calendar does not contain a service menu; Square can supply one where catalog
                data is available.
              </p>
              <fieldset>
                <legend className="mb-3 text-sm font-medium">
                  What works best for your phone?
                </legend>
                <div className="space-y-3">
                  {phoneOptions.map((p) => (
                    <label
                      key={p.id}
                      className={
                        "flex cursor-pointer gap-3 rounded-2xl border p-4 " +
                        (draft.phoneIntent === p.id
                          ? "border-violet bg-violet/10"
                          : "border-border")
                      }
                    >
                      <input
                        className="mt-1"
                        type="radio"
                        name="phone-intent"
                        value={p.id}
                        checked={draft.phoneIntent === p.id}
                        onChange={() => update({ phoneIntent: p.id })}
                      />
                      <span>
                        <span className="text-sm font-medium">{p.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {p.body}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button disabled={!ready} className={siteButton + " w-full"}>
                Show me my front desk
                <ArrowRight className="size-4" />
              </button>
              <p className="text-center text-xs text-muted-foreground">
                No sign-up. No card. No number reserved yet.
              </p>
            </form>
            <aside className="rounded-[28px] border border-violet/25 bg-gradient-to-br from-violet/15 to-surface p-7 sm:p-9">
              <BrandMark className="size-12" />
              <h3 className="mt-7 text-3xl font-semibold leading-tight tracking-tight">
                Keep the experience personal.
                <br />
                <span className="text-muted-foreground">Even when you're busy.</span>
              </h3>
              <div className="mt-8 space-y-7">
                {[
                  [
                    Phone,
                    "A warm welcome",
                    "Let routine calls get an answer while you focus on the client in your chair.",
                  ],
                  [
                    CalendarDays,
                    "Bookings that fit",
                    "Use a connected calendar and reviewed services to guide real appointment requests.",
                  ],
                  [
                    MessageSquare,
                    "Conversations that continue",
                    "Keep customer texts together, with your team able to step in.",
                  ],
                ].map(([Icon, title, body]) => {
                  const I = Icon as typeof Phone;
                  return (
                    <div key={String(title)} className="flex gap-3">
                      <I className="mt-1 size-5 shrink-0 text-violet" />
                      <div>
                        <p className="text-sm font-medium">{String(title)}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {String(body)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                Plans from $299/month plus $1,495 Custom Setup & Launch. Your complete price is
                shown before payment.
              </p>
            </aside>
          </div>
        ) : draft.step === 1 ? (
          <div className="mt-7 grid gap-7 lg:grid-cols-[1.1fr_.9fr]">
            <section className="rounded-[28px] border border-border bg-surface p-6 sm:p-9">
              <p className="text-xs uppercase tracking-[.17em] text-muted-foreground">
                Your opening greeting
              </p>
              <blockquote className="mt-5 text-2xl leading-9 tracking-tight">“{sample}”</blockquote>
              <button
                disabled={!speech}
                onClick={listen}
                className={siteGhost + " mt-6 disabled:opacity-40"}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? "Stop sample" : "Hear a sample"}
              </button>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Browser voice illustration. Preview the exact ElevenLabs voice and test real calls
                during your paid setup.
              </p>
              <Field label="Preferred voice personality">
                <select
                  className={inputClass + " mt-6"}
                  value={draft.voice}
                  onChange={(e) => update({ voice: e.target.value as PreviewDraft["voice"] })}
                >
                  {voices.map((v) => (
                    <option value={v.id} key={v.id}>
                      {v.name} — {v.vibe}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="mt-6">
                <Field label="Anything your agent should know? (optional)">
                  <textarea
                    className={inputClass + " min-h-28 py-3"}
                    maxLength={6000}
                    value={draft.services}
                    onChange={(e) => update({ services: e.target.value })}
                    placeholder="Your signature services, a menu excerpt, or what clients ask most."
                  />
                </Field>
                <p className="mt-2 text-xs text-muted-foreground">
                  Upload the full PDF, photo or service catalog after checkout. These notes stay a
                  draft until reviewed.
                </p>
              </div>
              <button onClick={() => go(2)} className={siteButton + " mt-7 w-full"}>
                Find my plan
                <ArrowRight className="size-4" />
              </button>
            </section>
            <aside className="rounded-[28px] border border-border p-7">
              <h3 className="text-xl font-medium">Your path to a working front desk</h3>
              <ol className="mt-6 space-y-6">
                {[
                  [
                    "Connect your calendar",
                    draft.calendarIntent === "square"
                      ? "Authorize Square and review your service catalog."
                      : draft.calendarIntent === "google"
                        ? "Authorize Google, then add or upload your service menu."
                        : "Choose a supported calendar or plan your native scheduling setup.",
                  ],
                  [
                    "Make it sound like you",
                    "Review your services, choose a voice and set policies.",
                  ],
                  [
                    "Connect your number",
                    phoneOptions.find((x) => x.id === draft.phoneIntent)!.body,
                  ],
                  [
                    "Test before launch",
                    "Try real calls and a test booking before forwarding clients.",
                  ],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-7 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                Calendar access, phone availability, number transfers and business texting depend on
                provider approval. Your setup will show what is confirmed and what still needs
                attention.
              </p>
            </aside>
          </div>
        ) : (
          <div className="mt-7">
            <PlanCards selected={draft.tier} onSelect={(tier) => update({ tier })} />
            <section className="mt-7 rounded-[24px] border border-border p-6">
              <h3 className="text-xl font-medium">Make room for what's next.</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Optional upgrades to discuss with your launch team. These selections are requests,
                not charges or active features.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="flex gap-3 rounded-2xl border border-border p-5">
                  <input
                    type="checkbox"
                    checked={draft.addonInterests.includes("scheduling")}
                    onChange={() => interest("scheduling")}
                  />
                  <span>
                    <span className="text-sm font-medium">{schedulingAddon.name}</span>
                    <span className="mt-2 block text-sm text-muted-foreground">
                      {draft.tier === "essential"
                        ? schedulingAddon.price +
                          "/month optional add-on. Keep appointments and team availability in one place."
                        : "Included in your plan. Ask the team to help configure it."}
                    </span>
                  </span>
                </label>
                <label className="flex gap-3 rounded-2xl border border-border p-5">
                  <input
                    type="checkbox"
                    checked={draft.addonInterests.includes("extra_location")}
                    onChange={() => interest("extra_location")}
                  />
                  <span>
                    <span className="text-sm font-medium">Another location</span>
                    <span className="mt-2 block text-sm text-muted-foreground">
                      ${usageRates.locationCents / 100}/month per additional location. Confirm
                      provisioning and billing with us first.
                    </span>
                  </span>
                </label>
              </div>
            </section>
            <PricingNotes />
            <div className="mt-8 flex flex-wrap items-center justify-between gap-6 rounded-[24px] border border-violet/25 bg-violet/10 p-6">
              <div>
                <p className="font-medium">
                  Salon Pro Agent {plan.name} for {draft.name}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.price}/month + {setup.price} one-time setup
                </p>
                <p className="mt-2 text-lg font-semibold">
                  Total today: ${(plan.monthlyCents + setup.cents) / 100}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Optional add-on requests are excluded. Monthly renewal terms appear in checkout.
                </p>
              </div>
              <a href={"/checkout?plan=" + draft.tier} className={siteButton}>
                Continue to payment
                <ArrowRight className="size-4" />
              </a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4" />
              Secure payment through Square. Create your account after payment is confirmed.
            </p>
          </div>
        )}
        {message && (
          <p role="status" className="mt-5 text-sm text-muted-foreground">
            {message}
          </p>
        )}
        {draft.step > 0 && (
          <button
            onClick={() => go(draft.step - 1)}
            className="mt-7 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
        )}
      </div>
    </SiteShell>
  );
}
