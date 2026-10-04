import { CookiePreferences } from "./CookiePreferences";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand/Brand";
import { contact } from "@/lib/site-content";
export const siteButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet";
export const siteGhost =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border px-6 text-sm font-medium transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-violet";
const navigation = [
  ["Features", "/features"],
  ["Integrations", "/integrations"],
  ["Pricing", "/pricing"],
  ["Help", "/help"],
  ["Contact", "/contact"],
] as const;
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="relative z-40 border-b border-border bg-background/90">
      <div className="mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
        <BrandLogo className="w-[175px] sm:w-[190px]" />
        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {navigation.map(([title, url]) => (
            <a
              key={url}
              href={url}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {title}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link to="/auth" className="text-sm">
            Sign in
          </Link>
          <a href="/get-started" className={siteButton}>
            Get started
            <ArrowUpRight className="size-4" />
          </a>
        </div>
        <button
          ref={toggle}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="grid size-11 place-items-center rounded-full border border-border lg:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav
          id="site-mobile-nav"
          aria-label="Mobile navigation"
          className="border-t border-border px-5 py-5 lg:hidden"
        >
          {navigation.map(([title, url]) => (
            <a
              key={url}
              href={url}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-sm hover:bg-accent"
            >
              {title}
            </a>
          ))}
          <div className="mt-4 flex gap-3">
            <Link to="/auth" className={siteGhost}>
              Sign in
            </Link>
            <a href="/get-started" className={siteButton}>
              Get started
              <ArrowRight className="size-4" />
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
const footerGroups = [
  {
    title: "Product",
    links: [
      ["Features", "/features"],
      ["Plans & pricing", "/pricing"],
      ["Get started", "/get-started"],
      ["Integrations", "/integrations"],
      ["Calendar integrations", "/integrations/calendars"],
    ],
  },
  {
    title: "Here to help",
    links: [
      ["Contact us", "/contact"],
      ["Help center", "/help"],
      ["FAQs", "/faq"],
      ["Sign in", "/auth"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy policy", "/privacy"],
      ["Terms of service", "/terms"],
      ["Cookies", "/cookies"],
      ["Messaging policy", "/messaging-policy"],
      ["All policies", "/legal"],
    ],
  },
];
export function SiteFooter() {
  return (
    <footer className="border-t border-border px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-[1.4fr_2fr]">
          <div>
            <BrandLogo className="w-[195px] sm:w-[195px]" />
            <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">
              A thoughtful front desk for every conversation, every client, every salon.
            </p>
            <a href={"mailto:" + contact.email} className="mt-5 block text-sm hover:underline">
              {contact.email}
            </a>
            <a href={contact.phoneHref} className="mt-2 block text-sm text-muted-foreground">
              {contact.phone}
            </a>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerGroups.map((g) => (
              <div key={g.title}>
                <h2 className="text-xs font-medium uppercase tracking-[.15em]">{g.title}</h2>
                <ul className="mt-5 space-y-3">
                  {g.links.map(([title, url]) => (
                    <li key={url}>
                      <a
                        href={url}
                        className="text-sm text-muted-foreground transition hover:text-foreground"
                      >
                        {title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-wrap justify-between gap-4 border-t border-border pt-7 text-xs leading-5 text-muted-foreground">
          <span>© {new Date().getFullYear()} Salon Pro Agent LLC</span>
          <span>{contact.address}</span>
          <CookiePreferences />
        </div>
      </div>
    </footer>
  );
}
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}
export function PageHero({
  eyebrow,
  title,
  accent,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative border-b border-border px-5 py-16 sm:px-8 sm:py-24">
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-96 rounded-full bg-violet/10 blur-[100px]" />
      <div className="relative mx-auto max-w-7xl">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[.2em] text-muted-foreground">
          <BrandMark className="size-5" />
          {eyebrow}
        </p>
        <h1 className="mt-7 max-w-4xl text-4xl font-semibold leading-[1.07] tracking-[-.045em] sm:text-6xl lg:text-7xl">
          {title}
          {accent && (
            <>
              <br />
              <span className="text-gradient">{accent}</span>
            </>
          )}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {body}
        </p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
export function BottomCTA() {
  return (
    <section className="px-5 py-16 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 rounded-[28px] border border-violet/25 bg-gradient-to-r from-violet/10 to-transparent p-7 sm:p-10 md:flex-row md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[.17em] text-muted-foreground">
            Your next chapter
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Give your salon room to grow.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Choose your plan. Meet your agent. Make it yours.
          </p>
        </div>
        <a href="/get-started" className={siteButton}>
          Get started today
          <ArrowUpRight className="size-4" />
        </a>
      </div>
    </section>
  );
}
export function pageMeta(title: string, description: string) {
  return {
    meta: [
      { title: title + " — Salon Pro Agent" },
      { name: "description", content: description },
      { property: "og:title", content: title + " — Salon Pro Agent" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  };
}
