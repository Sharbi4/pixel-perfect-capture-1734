import {
  DashboardIntegrations,
  DashboardPhones,
  DashboardBilling,
  DashboardAnalytics,
} from "@/components/dashboard/OperationsPages";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { NAV, SECTION_COPY } from "@/components/dashboard/nav";
import { useActiveLocation as useLocation } from "@/components/dashboard/location-context";

export const Route = createFileRoute("/_authenticated/dashboard/$section")({
  beforeLoad: ({ params }) => {
    if (!SECTION_COPY[params.section]) throw notFound();
  },
  head: ({ params }) => {
    const t = `${NAV.find((n) => n.slug === params.section)?.label ?? "Dashboard"} — Salon Pro Agent`;
    return {
      meta: [
        { title: t },
        { name: "description", content: SECTION_COPY[params.section] ?? "" },
        { property: "og:title", content: t },
        { property: "og:description", content: SECTION_COPY[params.section] ?? "" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => <p className="text-muted-foreground">This page doesn't exist.</p>,
  component: Section,
});

function Section() {
  const { section } = Route.useParams();
  const { location } = useLocation();
  if (section === "integrations") return <DashboardIntegrations />;
  if (section === "phone-numbers") return <DashboardPhones />;
  if (section === "billing") return <DashboardBilling />;
  if (section === "analytics") return <DashboardAnalytics />;
  const item = NAV.find((n) => n.slug === section)!;
  const I = item.icon;
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-muted-foreground">{location.name || "Your salon"}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{item.label}</h1>
      <p className="mt-2 text-muted-foreground">{SECTION_COPY[section]}</p>
      <div className="glass mt-8 grid place-items-center rounded-[28px] px-6 py-20 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent">
          <I className="size-6 text-violet" />
        </span>
        <h2 className="mt-5 text-lg font-medium">Coming in the next update</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          We're building this page now. Nothing here yet — your agent keeps working in the meantime.
        </p>
      </div>
    </div>
  );
}
