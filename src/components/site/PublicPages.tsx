import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Headphones,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  FileText,
} from "lucide-react";
import { SiteShell, PageHero, BottomCTA, siteButton, siteGhost } from "./SiteShell";
import { PlanCards, PlanComparison, PricingNotes } from "./PlanCards";
import { contact, faqs, integrations } from "@/lib/site-content";
const wrap = "mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20";
export function PricingPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Plans & pricing"
        title="A front desk that fits."
        accent="Room to grow."
        body="Three clear plans. Included voice and texting. Choose the support your salon needs today, with a path for tomorrow."
      />
      <section className={wrap}>
        <PlanCards />
        <PricingNotes />
        <PlanComparison />
      </section>
      <BottomCTA />
    </SiteShell>
  );
}
const features = [
  {
    icon: Phone,
    title: "A warm welcome. Every time.",
    body: "Your agent uses your service menu, prices, hours and policies to answer the everyday questions that interrupt your busiest moments.",
    tag: "AI receptionist",
  },
  {
    icon: MessageSquare,
    title: "Keep the conversation going.",
    body: "A shared inbox brings customer texts together. Your team can step in, use templates and return a conversation to the agent when ready.",
    tag: "Customer conversations",
  },
  {
    icon: CalendarDays,
    title: "Make space for the next booking.",
    body: "Native scheduling connects services, staff availability and appointments. External calendar connections are on the roadmap, starting with Square.",
    tag: "Scheduling",
  },
  {
    icon: Headphones,
    title: "Hear the value for yourself.",
    body: "Review real call summaries, transcripts and outcomes. Available recordings help your team understand what happened and who needs a follow-up.",
    tag: "Call intelligence",
  },
  {
    icon: BookOpen,
    title: "Your salon. Your knowledge.",
    body: "Update your menu, policies and frequently asked questions through structured controls. Review imported service changes before publishing them.",
    tag: "Business knowledge",
  },
  {
    icon: Users,
    title: "A workspace for your team.",
    body: "Switch between assigned locations and manage conversations in context. Access depends on your workspace role and location membership.",
    tag: "Salon operations",
  },
];
export function FeaturesPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="The salon front desk, reimagined"
        title="More time with clients."
        accent="Less time catching up."
        body="Give every conversation a home. Salon Pro Agent brings your receptionist, service knowledge, conversations and scheduling tools together."
      >
        <a href="/get-started" className={siteButton}>
          Find your plan
          <ArrowRight className="size-4" />
        </a>
        <a href="/#talk" className={siteGhost}>
          See it in action
        </a>
      </PageHero>
      <section className={wrap}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: I, title, body, tag }) => (
            <article key={tag} className="rounded-[26px] border border-border bg-surface/40 p-7">
              <div className="mb-8 flex items-center justify-between">
                <I className="size-6 text-violet" />
                <span className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">
                  {tag}
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 grid gap-8 rounded-[28px] border border-border p-7 md:grid-cols-2 sm:p-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Built around your business
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              You set the standard.
              <br />
              Your agent follows it.
            </h2>
          </div>
          <div className="space-y-5">
            {[
              "Your services, prices and approved policies",
              "Your voice, greeting and supported languages",
              "Your staff, availability and booking rules",
              "Your human takeover and escalation preferences",
            ].map((x) => (
              <p key={x} className="flex gap-3 text-sm">
                <Check className="size-4 shrink-0 text-success" />
                {x}
              </p>
            ))}
            <p className="text-xs leading-6 text-muted-foreground">
              Capabilities vary by plan and configured connection. Phone, messaging and calendar
              readiness are verified separately during launch.
            </p>
          </div>
        </div>
      </section>
      <BottomCTA />
    </SiteShell>
  );
}
export function ContactPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Contact us"
        title="Let's talk about"
        accent="your salon."
        body="Choosing a plan, getting set up, or looking for a hand? Reach the Salon Pro Agent team directly."
      />
      <section className={wrap}>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Mail,
              label: "Email us",
              value: contact.email,
              href: "mailto:" + contact.email,
              body: "For product questions, account support and launch assistance.",
            },
            {
              icon: Phone,
              label: "Give us a call",
              value: contact.phone,
              href: contact.phoneHref,
              body: "Talk through your salon's needs and the next steps.",
            },
            {
              icon: MapPin,
              label: "Business address",
              value: contact.street,
              href:
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(contact.address),
              body: contact.city,
            },
          ].map(({ icon: I, label, value, href, body }) => (
            <article
              key={label}
              className="flex flex-col rounded-[26px] border border-border bg-surface/50 p-7"
            >
              <I className="mb-8 size-6 text-violet" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
              <a
                href={href}
                className="mt-3 break-words text-xl font-medium tracking-tight hover:underline"
              >
                {value}
              </a>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 grid gap-8 border-t border-border pt-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">A little context goes a long way.</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              When asking for support, include your salon name, account email and a short
              description of what you need. Please keep passwords, API keys and payment-card details
              out of your message.
            </p>
          </div>
          <div className="grid gap-3">
            <a
              href="/help"
              className="flex items-center justify-between rounded-2xl border border-border p-5 hover:bg-accent"
            >
              <span>Explore the help center</span>
              <ArrowUpRight className="size-4" />
            </a>
            <a
              href="/faq"
              className="flex items-center justify-between rounded-2xl border border-border p-5 hover:bg-accent"
            >
              <span>Read frequently asked questions</span>
              <ArrowUpRight className="size-4" />
            </a>
            <a
              href="/get-started"
              className="flex items-center justify-between rounded-2xl border border-border p-5 hover:bg-accent"
            >
              <span>Find the right plan</span>
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
const guides = [
  {
    id: "getting-started",
    icon: Sparkles,
    title: "Getting started",
    summary: "From your first preview to a confident launch.",
    steps: [
      "Compare plans and choose your included voice, texting and location allowances.",
      "Add your salon name and explore the receptionist preview.",
      "Review your selected plan, setup charge and recurring amount before checkout.",
      "After confirmed payment, verify your email and finish your account.",
      "Review your services, hours and policies, then complete phone, calendar and texting checks with the launch team.",
    ],
  },
  {
    id: "phone",
    icon: Phone,
    title: "Your phone number",
    summary: "Understand forwarding, new numbers and transfers.",
    steps: [
      "Decide whether you want a new number or to keep your current number.",
      "For forwarding, follow the instructions specific to your current carrier and test an actual call.",
      "Forwarding voice calls does not automatically transfer SMS service.",
      "For porting, confirm eligibility and ownership documentation with support. Keep the current service active until the port is confirmed.",
    ],
  },
  {
    id: "calendar",
    icon: CalendarDays,
    title: "Calendar & bookings",
    summary: "Keep availability grounded in a connected system.",
    steps: [
      "Salon Pro Scheduling is the currently implemented native booking option.",
      "Review services, durations, staff availability and business time zone before enabling bookings.",
      "Square Appointments and other external calendars remain planned; see the integrations directory for status.",
      "If a calendar cannot confirm availability, the agent should take a message instead of promising a booking.",
    ],
  },
  {
    id: "messages",
    icon: MessageSquare,
    title: "Messages & human takeover",
    summary: "Make texting feel like part of your front desk.",
    steps: [
      "Complete the applicable business messaging registration before launch.",
      "Use the shared inbox to read customer conversations and take over when needed.",
      "Keep appointment messages separate from marketing. Obtain the appropriate consent and respect opt-out requests.",
      "Check delivery status before assuming a client received a reminder. Templates and automation settings live in your dashboard.",
    ],
  },
  {
    id: "billing",
    icon: FileText,
    title: "Plans & billing",
    summary: "Know your allowance and what happens next.",
    steps: [
      "Your monthly subscription and Custom Setup & Launch are separate line items.",
      "SMS allowances count segments, not just messages. Longer or multilingual messages may use several segments.",
      "Review additional-usage rates and confirm any add-ons with support before enabling them.",
      "For invoice questions, changes or cancellation, contact support with your salon name and account email.",
    ],
  },
  {
    id: "agent",
    icon: Settings2,
    title: "Services & your agent",
    summary: "Keep your salon knowledge useful and accurate.",
    steps: [
      "Use structured settings to adjust your greeting, voice, languages and business policies.",
      "Upload a menu or edit services in Services & Menu. Review the proposed changes before approval.",
      "Check the agent's sync status after saving. A saved edit is not proof a provider update succeeded.",
      "Run a test conversation and check prices, hours, bookings and human transfer behavior before launch.",
    ],
  },
];
export function HelpPage() {
  const [q, setQ] = useState("");
  const matches = guides.filter((g) =>
    (g.title + " " + g.summary + " " + g.steps.join(" ")).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <SiteShell>
      <PageHero
        eyebrow="Help center"
        title="A little guidance."
        accent="A lot more confidence."
        body="Practical help for your salon's front desk, from choosing a plan to keeping daily operations running."
      >
        <label className="flex w-full max-w-lg items-center gap-3 rounded-full border border-border bg-surface px-5 py-3.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            aria-label="Search help guides"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search setup, calls, billing…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </PageHero>
      <section className={wrap}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((g) => (
            <a
              key={g.id}
              href={"#" + g.id}
              className="rounded-[24px] border border-border bg-surface/40 p-6 transition hover:border-violet/50"
            >
              <g.icon className="size-5 text-violet" />
              <h2 className="mt-6 text-xl font-semibold">{g.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{g.summary}</p>
              <span className="mt-5 flex items-center gap-2 text-xs">
                Read guide
                <ArrowRight className="size-3" />
              </span>
            </a>
          ))}
        </div>
        {!matches.length && (
          <p role="status" className="py-10 text-muted-foreground">
            No matching guides. Try another search or contact our team.
          </p>
        )}
        <div className="mt-14 divide-y divide-border">
          {matches.map((g) => (
            <article
              key={g.id}
              id={g.id}
              className="scroll-mt-8 grid gap-7 py-10 md:grid-cols-[1fr_2fr]"
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{g.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{g.summary}</p>
              </div>
              <ol className="space-y-5">
                {g.steps.map((step, i) => (
                  <li key={step} className="flex gap-4 text-sm leading-7 text-muted-foreground">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-xs text-foreground">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-[24px] border border-border p-8">
          <h2 className="text-2xl font-semibold">Still need a hand?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            We're here to help with your account and salon setup.
          </p>
          <a href="/contact" className={siteButton + " mt-6"}>
            Contact support
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </section>
    </SiteShell>
  );
}
export function FAQPage() {
  const [q, setQ] = useState("");
  const items = faqs.filter((f) =>
    (f.q + " " + f.a + " " + f.category).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <SiteShell>
      <PageHero
        eyebrow="Frequently asked questions"
        title="Good questions."
        accent="Clear answers."
        body="The details on plans, phone numbers, booking, texting and getting your salon ready."
      >
        <label className="flex w-full max-w-lg items-center gap-3 rounded-full border border-border bg-surface px-5 py-3.5">
          <Search className="size-4" />
          <input
            aria-label="Search frequently asked questions"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What would you like to know?"
          />
        </label>
      </PageHero>
      <section className={wrap}>
        <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
          <aside>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Talk to our team
            </p>
            <h2 className="mt-4 text-2xl font-semibold">Your salon is unique.</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              If you don't see your question here, let's work through it together.
            </p>
            <a href="/contact" className={siteGhost + " mt-6"}>
              Get in touch
              <ArrowUpRight className="size-4" />
            </a>
          </aside>
          <div>
            {[...new Set(items.map((f) => f.category))].map((category) => (
              <section key={category} className="mb-10">
                <h2 className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
                  {category}
                </h2>
                <div className="divide-y divide-border rounded-2xl border border-border px-5 sm:px-7">
                  {items
                    .filter((f) => f.category === category)
                    .map((f) => (
                      <details key={f.q} className="group py-5">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                          {f.q}
                          <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
                        </summary>
                        <p className="mt-4 pr-6 text-sm leading-7 text-muted-foreground">{f.a}</p>
                      </details>
                    ))}
                </div>
              </section>
            ))}
            {!items.length && (
              <p role="status">No matching answers. Try another search or contact support.</p>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
export function IntegrationsPage({ calendars = false }: { calendars?: boolean }) {
  return (
    <SiteShell>
      <PageHero
        eyebrow={calendars ? "Calendar integrations" : "Integration directory"}
        title={calendars ? "Your calendar." : "Your salon's systems."}
        accent={calendars ? "Part of the conversation." : "One connected experience."}
        body={
          calendars
            ? "Booking should follow real availability. Explore native scheduling and the external calendar connections on our roadmap."
            : "A clear view of what's available today and what we're planning next. Choose connections that make sense for your business."
        }
      >
        <a href="/contact" className={siteButton}>
          Discuss your setup
          <ArrowUpRight className="size-4" />
        </a>
        {!calendars && (
          <a href="/integrations/calendars" className={siteGhost}>
            Explore calendars
            <ArrowRight className="size-4" />
          </a>
        )}
      </PageHero>
      <section className={wrap}>
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-border p-5 text-sm leading-6 text-muted-foreground">
          <ShieldCheck className="mt-1 size-5 shrink-0 text-violet" />
          Planned integrations are not live connections. Your dashboard shows the actual readiness
          of your salon's connected services.
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((i) => (
            <article
              key={i.name}
              className="flex flex-col rounded-[26px] border border-border bg-surface/40 p-7"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-12 place-items-center rounded-xl border border-border bg-background text-sm font-semibold">
                  {i.monogram}
                </span>
                <span
                  className={
                    "rounded-full border px-3 py-1 text-[10px] " +
                    (i.status === "Available"
                      ? "border-success/25 bg-success/10 text-success"
                      : "border-border text-muted-foreground")
                  }
                >
                  {i.status}
                </span>
              </div>
              <p className="mt-7 text-[10px] uppercase tracking-widest text-muted-foreground">
                {i.category}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{i.name}</h2>
              <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{i.description}</p>
              <p className="mt-6 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
                {i.detail}
              </p>
            </article>
          ))}
        </div>
        {!calendars && (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              [
                "Phone System",
                "Calling and number setup require a configured phone connection and separate voice verification.",
              ],
              [
                "AI Receptionist",
                "Your agent's configuration and sync status are shown in your salon workspace.",
              ],
              [
                "Payments",
                "Square handles platform checkout when configured. Payment availability is separate from Square Appointments calendar support.",
              ],
            ].map(([title, body]) => (
              <article key={title} className="rounded-2xl border border-border p-6">
                <h2 className="text-lg font-medium">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        )}
        <p className="mt-8 text-xs leading-6 text-muted-foreground">
          Provider names identify compatible or planned services. They do not imply a partnership,
          certification or endorsement. Roadmap availability may change.
        </p>
      </section>
      <BottomCTA />
    </SiteShell>
  );
}
