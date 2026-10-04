import { ArrowUpRight, FileText } from "lucide-react";
import { legalDocuments } from "@/lib/legal-content";
import { SiteShell, PageHero, siteGhost } from "./SiteShell";
export function LegalHub() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Legal & trust"
        title="Clear policies."
        accent="Thoughtful service."
        body="Learn how Salon Pro Agent LLC handles platform use, customer information, messaging and billing."
      />
      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-16 sm:px-8 md:grid-cols-2">
        {legalDocuments.map((d) => (
          <a
            key={d.slug}
            href={"/" + d.slug}
            className="group rounded-[24px] border border-border bg-surface/40 p-7 transition hover:border-violet/40"
          >
            <div className="flex justify-between">
              <FileText className="size-5 text-violet" />
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">{d.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{d.summary}</p>
          </a>
        ))}
      </section>
    </SiteShell>
  );
}
export function LegalPage({ slug }: { slug: string }) {
  const d = legalDocuments.find((x) => x.slug === slug)!;
  return (
    <SiteShell>
      <PageHero eyebrow="Legal & trust" title={d.title} body={d.summary} />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <p className="text-xs leading-6 text-muted-foreground">
            Salon Pro Agent LLC
            <br />
            Last updated October 4, 2026
          </p>
          <nav aria-label="On this page" className="mt-7 space-y-3">
            {d.sections.map((s, i) => (
              <a
                key={s.title}
                href={"#section-" + i}
                className="block text-sm leading-6 text-muted-foreground hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </nav>
          <a href="/legal" className={siteGhost + " mt-8"}>
            All policies
          </a>
        </aside>
        <article className="max-w-3xl">
          {d.sections.map((s, i) => (
            <section key={s.title} id={"section-" + i} className="scroll-mt-8 pb-10">
              <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-4 text-sm leading-8 text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <div className="rounded-2xl border border-border p-6">
            <h2 className="font-medium">Questions about this policy?</h2>
            <a
              href="mailto:support@salonagentai.com"
              className="mt-3 block break-words text-sm text-muted-foreground hover:underline"
            >
              support@salonagentai.com
            </a>
            <a href="tel:+15205511113" className="mt-2 block text-sm text-muted-foreground">
              520-551-1113
            </a>
          </div>
        </article>
      </div>
    </SiteShell>
  );
}
