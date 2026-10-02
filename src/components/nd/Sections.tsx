import { useEffect, useState } from "react";
import {
  ArrowRight, BellRing, CalendarCheck, Check, HelpCircle, Languages, Menu, MessageSquareText,
  Moon, Phone, PhoneForwarded, Repeat, UserRound, X,
} from "lucide-react";
import { plan } from "@/lib/pricing";
import { CallDemo } from "./CallDemo";
import { TextDemo } from "./TextDemo";
import { Dashboard } from "./Dashboard";
import { Eyebrow, Logo, NdButton, Reveal, SectionHead, Waveform } from "./primitives";
import { useSequence } from "./useSequence";

const nav = [
  ["Product", "#product"],
  ["NailDesk Pro", "#receptionist"],
  ["Text to Book", "#text-to-book"],
  ["How It Works", "#how"],
  ["Pricing", "#pricing"],
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <div className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 transition-all duration-300 ${scrolled || open ? "glass" : ""}`}>
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map(([l, h]) => (
            <a key={h} href={h} className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{l}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <NdButton variant="link" size="sm" href="/auth">Sign In</NdButton>
          <NdButton size="sm" href="/setup">{plan.cta}</NdButton>
        </div>
        <button className="grid size-9 place-items-center rounded-full lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="glass animate-rise mx-auto mt-2 max-w-6xl rounded-3xl p-3 lg:hidden">
          {nav.map(([l, h]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-sm hover:bg-accent">{l}</a>
          ))}
          <div className="mt-2 flex gap-2 p-1">
            <NdButton variant="ghost" size="sm" href="/auth" className="flex-1">Sign In</NdButton>
            <NdButton size="sm" href="/setup" className="flex-1">{plan.cta}</NdButton>
          </div>
        </div>
      )}
    </header>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-4 pt-36 pb-24 md:pt-44">
      <div className="aurora -top-40 left-[-10%] size-[620px] bg-cobalt" />
      <div className="aurora top-10 right-[-15%] size-[560px] bg-magenta [animation-delay:-6s]" />
      <div className="aurora top-[40%] left-[35%] size-[420px] bg-violet [animation-delay:-11s]" />
      <div className="grid-fade absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-rise">
          <Eyebrow>The AI front desk for nail salons</Eyebrow>
          <h1 className="mt-6 text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance md:text-7xl">
            Your salon is busy.
            <br />
            <span className="text-gradient">Your front desk shouldn't be.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            NailDesk answers customers, books appointments and keeps your calendar moving through calls and text — even when everyone in the salon is busy with a client.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <NdButton size="lg" href="#receptionist"><Phone className="size-4" /> Hear NailDesk Answer a Call</NdButton>
            <NdButton size="lg" variant="ghost" href="#how">See How It Works</NdButton>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Built for nail salons <span className="mx-2 opacity-40">•</span> Works with your existing number <span className="mx-2 opacity-40">•</span> English + Vietnamese
          </p>
        </div>
        <CallDemo />
      </div>
    </section>
  );
}

export function TextToBook() {
  return (
    <section id="text-to-book" className="relative scroll-mt-24 px-4 py-28">
      <div className="aurora top-1/3 left-1/2 size-[500px] -translate-x-1/2 bg-violet opacity-25" />
      <div className="relative mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Text to Book"
          title={<>They don't even <span className="text-gradient">have to call.</span></>}
          body="Customers can text your salon just like they text a friend. NailDesk understands what they need, checks availability and books the appointment automatically."
        />
        <Reveal className="mt-16"><TextDemo /></Reveal>
      </div>
    </section>
  );
}

const channels = [
  { icon: Phone, t: "Calls", d: "AI answers incoming salon calls.", demo: "“Thanks for calling Luna Nails…”" },
  { icon: MessageSquareText, t: "Texts", d: "Customers can text questions or book appointments.", demo: "419 texts handled this month" },
  { icon: CalendarCheck, t: "Appointments", d: "NailDesk checks availability and manages bookings.", demo: "Books · reschedules · cancels" },
  { icon: BellRing, t: "Confirmations", d: "Automatic confirmations and reminders.", demo: "Reminder sent · 24h before" },
  { icon: HelpCircle, t: "Questions", d: "NailDesk knows salon hours, pricing, services and policies.", demo: "“Gel removal is $10 with a new set.”" },
  { icon: PhoneForwarded, t: "Human handoff", d: "Transfer complicated conversations to staff.", demo: "Transferring to front desk…" },
];

export function Channels() {
  return (
    <section id="product" className="scroll-mt-24 px-4 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow="Product" title="One front desk. Every channel." body="Every call, text and booking flows through one AI that knows your salon as well as your best receptionist." />
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map(({ icon: I, t, d, demo }, i) => (
            <Reveal key={t} delay={i * 70}>
              <div className="group glass relative h-full overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                <div className="bg-brand absolute -top-24 -right-24 size-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40" />
                <div className="relative">
                  <div className="grid size-11 place-items-center rounded-2xl border border-border bg-surface-2 transition-colors group-hover:border-violet">
                    <I className="size-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">{t}</h3>
                  <p className="mt-2 text-muted-foreground">{d}</p>
                  <div className="mt-6 rounded-xl border border-border bg-background/60 px-3.5 py-2.5 font-mono text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                    {demo}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const voiceFeatures = [
  [Sparkle, "Natural AI conversations"], [CalendarCheck, "Book and reschedule appointments"], [HelpCircle, "Answers service and pricing questions"],
  [Languages, "English + Vietnamese"], [Moon, "After-hours answering"], [PhoneForwarded, "Smart call transfers"], [MessageSquareText, "SMS follow-up after calls"],
] as const;
function Sparkle(p: { className?: string }) { return <Waveform bars={4} className={`h-4 ${p.className ?? ""}`} />; }

const transcript = [
  ["Caller", "Hi, I need to move my appointment to Saturday."],
  ["NailDesk", "Of course. I have 11:00 AM or 1:30 PM with Kim."],
  ["Caller", "11 is perfect."],
  ["NailDesk", "Done — I'll text you the confirmation now."],
];

export function VoiceUpsell() {
  const s = useSequence([1200, 1600, 1400, 1600, 1500], 3000);
  return (
    <section id="receptionist" className="relative scroll-mt-24 overflow-hidden px-4 py-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] border border-border bg-surface p-8 md:p-14">
        <div className="aurora -bottom-40 -left-20 size-[500px] bg-magenta opacity-40" />
        <div className="aurora -top-40 right-0 size-[500px] bg-cobalt opacity-40 [animation-delay:-8s]" />
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>NailDesk Pro · AI phone receptionist</Eyebrow>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.035em] text-balance md:text-5xl">
              Give your salon a receptionist that <span className="text-gradient">answers every call.</span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              NailDesk Pro is your AI phone receptionist — it answers your salon's phone 24/7, so your technicians stay focused on the client in their chair, not the one on hold.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {voiceFeatures.map(([I, t]) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent"><I className="size-4" /></span>
                  {t}
                </li>
              ))}
            </ul>
            <NdButton variant="brand" size="lg" href="/setup" className="mt-10">{plan.cta} <ArrowRight className="size-4" /></NdButton>
          </Reveal>
          <Reveal delay={150}>
            <div className="glass rounded-[28px] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-2 rounded-full bg-success pulse-ring" /> Live call · Line 1
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">EN · VI</span>
              </div>
              <div className="mt-5 grid place-items-center rounded-2xl bg-background/60 py-8">
                <Waveform bars={40} className="h-14" />
              </div>
              <div className="mt-4 text-[11px] tracking-wider text-muted-foreground uppercase">Live transcription</div>
              <div className="mt-2 min-h-[170px] space-y-2 font-mono text-[13px]">
                {transcript.slice(0, Math.min(s, 4)).map(([w, t]) => (
                  <div key={t} className="animate-rise flex gap-3">
                    <span className={`w-16 shrink-0 ${w === "NailDesk" ? "text-violet" : "text-muted-foreground"}`}>{w}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <div className={`mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3.5 transition-all duration-500 ${s >= 5 ? "opacity-100" : "opacity-30"}`}>
                <Repeat className="size-4 text-violet" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Rescheduled · Sat 11:00 AM with Kim</div>
                  <div className="text-xs text-muted-foreground">Confirmation text sent</div>
                </div>
                {s >= 5 && <Check className="size-4 text-success" />}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Value() {
  const before = ["Phone rings while technicians are working", "Customer hangs up", "Staff forget to return calls", "Appointment opportunities disappear", "Repetitive questions interrupt the salon"];
  const after = ["Every customer receives an answer", "Appointments book automatically", "Staff stay focused on clients", "Customers can call or text", "Salon stays available after hours"];
  return (
    <section className="px-4 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead title={<>Stop putting down the nail brush <span className="text-muted-foreground">to answer the phone.</span></>} />
        <div className="mt-16 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl border border-border p-8">
              <div className="text-sm font-medium text-muted-foreground">Before NailDesk</div>
              <ul className="mt-6 space-y-4">
                {before.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-muted-foreground">
                    <X className="mt-0.5 size-4 shrink-0 text-destructive/70" />
                    <span className="line-through decoration-border">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="relative h-full overflow-hidden rounded-3xl p-px">
              <div className="bg-brand absolute inset-0 opacity-70" />
              <div className="relative h-full rounded-[23px] bg-surface p-8">
                <div className="text-gradient text-sm font-medium">With NailDesk</div>
                <ul className="mt-6 space-y-4">
                  {after.map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="bg-brand mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"><Check className="size-3 text-primary-foreground" /></span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function DashboardSection() {
  return (
    <section className="relative px-4 py-28">
      <div className="aurora top-1/2 left-1/2 size-[700px] -translate-x-1/2 -translate-y-1/2 bg-cobalt opacity-20" />
      <div className="relative mx-auto max-w-6xl">
        <SectionHead eyebrow="Dashboard" title="See everything your front desk handled." body="Every conversation, booking and call — organized in one place, ready when you finish your last client." />
        <Reveal className="mt-16"><Dashboard /></Reveal>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    ["Connect your salon", "Add your services, staff, hours, pricing and booking system.", UserRound],
    ["Connect your number", "Keep your existing number. NailDesk can handle calls and texts.", Phone],
    ["NailDesk gets to work", "Customers call or text and NailDesk handles the conversation and booking automatically.", CalendarCheck],
  ] as const;
  return (
    <section id="how" className="scroll-mt-24 px-4 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow="How it works" title="Live in three steps." />
        <div className="relative mt-16 grid gap-4 md:grid-cols-3">
          <div className="bg-brand absolute top-10 right-[16%] left-[16%] hidden h-px opacity-40 md:block" />
          {steps.map(([t, d, I], i) => (
            <Reveal key={t} delay={i * 100}>
              <div className="relative text-center">
                <div className="glass mx-auto grid size-20 place-items-center rounded-3xl bg-background">
                  <I className="size-6" />
                </div>
                <div className="mt-6 font-mono text-xs text-muted-foreground">0{i + 1}</div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{t}</h3>
                <p className="mx-auto mt-2 max-w-xs text-muted-foreground">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 px-4 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow="Pricing" title={<>One plan: <span className="text-gradient">your AI phone receptionist.</span></>} body="NailDesk Pro is the product — everything your salon needs to answer calls and texts, book appointments, and stay available 24/7. Set up for you by our team." />
        <Reveal>
          <div className="relative mt-16 overflow-hidden rounded-[28px] p-px">
            <div className="bg-brand absolute inset-0" />
            <div className="relative rounded-[27px] bg-surface p-8 md:p-12">
              <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-semibold tracking-tight">{plan.name}</h3>
                    <span className="rounded-full bg-accent px-3 py-1 text-xs">{plan.badge}</span>
                  </div>
                  <p className="mt-4 max-w-md text-muted-foreground">{plan.description}</p>
                  <div className="mt-8 flex items-baseline gap-1">
                    <span className="text-6xl font-semibold tracking-[-0.04em]">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-border bg-background/50 px-4 py-2.5 text-sm">
                    <span className="font-medium">{plan.setupLabel}</span>
                    <span className="text-muted-foreground">{plan.setupPrice} {plan.setupNote}</span>
                  </div>
                  <NdButton size="lg" href="/setup" className="mt-8 w-full sm:w-auto">{plan.cta} <ArrowRight className="size-4" /></NdButton>
                </div>
                <div className="lg:border-l lg:border-border lg:pl-12">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What's included</span>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm"><Check className="size-4 shrink-0 text-success" />{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-4 py-36 text-center">
      <div className="aurora top-0 left-[10%] size-[600px] bg-violet" />
      <div className="aurora top-10 right-[5%] size-[500px] bg-magenta [animation-delay:-5s]" />
      <div className="aurora bottom-[-30%] left-[40%] size-[500px] bg-coral opacity-40 [animation-delay:-9s]" />
      <Reveal className="relative mx-auto max-w-4xl">
        <h2 className="text-5xl leading-[1] font-semibold tracking-[-0.045em] text-balance md:text-7xl">Your next appointment may already be calling.</h2>
        <p className="mt-6 text-xl text-muted-foreground">Make sure someone answers.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <NdButton size="lg" href="/setup">{plan.cta}</NdButton>
          <NdButton size="lg" variant="ghost" href="#receptionist"><Phone className="size-4" /> Hear NailDesk Pro</NdButton>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <Logo />
        <span>The AI front desk for nail salons.</span>
        <span>© {new Date().getFullYear()} NailDesk AI</span>
      </div>
    </footer>
  );
}

export function SetupFlow() {
  const steps = [
    ["Tell us about your salon", "Name, hours, languages, and your services. Upload a menu or paste your website and we fill it in."],
    ["Pick your voice", "Choose from six receptionists, then hear each one answer with your salon's name."],
    ["We build your receptionist", "NailDesk Pro learns your prices, policies and booking rules for you. No tech skills needed."],
    ["Go live", "Forward your calls and you're answering 24/7. Texting starts once business texting is approved."],
  ];
  const ways = [
    ["Online", "Finish setup yourself in about 10 minutes."],
    ["By phone", "Call NailDesk Pro and it sets things up with you."],
    ["Done for you", "Our team handles every step."],
  ];
  return (
    <section id="setup" className="scroll-mt-24 px-4 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow="Setup" title="Set up in minutes, not weeks." body="You share the basics. NailDesk Pro builds itself around your salon." />
        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {steps.map(([t, d], i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="glass h-full rounded-3xl p-6">
                <div className="font-mono text-xs text-muted-foreground">0{i + 1}</div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ways.map(([t, d]) => (
            <div key={t} className="rounded-3xl border border-border p-5">
              <div className="font-medium">{t}</div>
              <div className="text-sm text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <NdButton size="lg" href="/setup">Start setup <ArrowRight className="size-4" /></NdButton>
        </div>
      </div>
    </section>
  );
}
