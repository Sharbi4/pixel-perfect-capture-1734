import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LocationCtx } from "@/components/dashboard/location-context";
import { Check, ChevronsUpDown, Loader2, LogOut, Menu, Plus, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/Brand";
import { NAV } from "@/components/dashboard/nav";
import { cityLine, getActiveLocationId, listLocations, setActiveLocationId, type Location } from "@/lib/locations";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Salon Pro Agent" },
      { name: "description", content: "Your salon's AI front desk command center: calls, texts, bookings and performance." },
      { property: "og:title", content: "Dashboard — Salon Pro Agent" },
      { property: "og:description", content: "Command center for your salon's AI receptionist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardLayout,
});


function DashboardLayout() {
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    listLocations().then((l) => { setLocations(l); setActiveId(getActiveLocationId()); }).catch(() => setErr("We couldn't load your salons. Please refresh."));
  }, []);

  if (err) return <div className="grid min-h-screen place-items-center p-6 text-center" role="alert">{err}</div>;
  if (!locations) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></div>;
  if (!locations.length) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div><h1 className="text-2xl font-semibold">No salon yet</h1><p className="mt-2 text-muted-foreground">Set up your salon to open your dashboard.</p>
          <Link to="/setup" className="bg-brand mt-6 inline-flex h-11 items-center rounded-full px-6 text-sm font-medium text-primary-foreground">Start setup</Link></div>
      </div>
    );
  }
  const location = (locations.find((l) => l.id === activeId) ?? locations[0])!;
  const pick = (id: string) => { setActiveLocationId(id); setActiveId(id); };

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <BrandLogo className="w-[170px] sm:w-[170px]" />
      <LocationSwitcher locations={locations} active={location} onPick={pick} />
      <nav className="-mx-1 flex-1 space-y-0.5 overflow-y-auto" aria-label="Dashboard">
        {NAV.map(({ slug, label, icon: I }) => (
          <Link
            key={label}
            to={slug ? "/dashboard/$section" : "/dashboard"}
            params={{ section: slug }}
            activeOptions={{ exact: true }}
            onClick={() => setMobileOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
          >
            <I className="size-4 shrink-0 group-data-[status=active]:text-violet" />{label}
          </Link>
        ))}
      </nav>
      <button onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/"))} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );

  return (
    <LocationCtx.Provider value={{ location, locations }}>
      <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="sticky top-0 hidden h-screen border-r border-border bg-surface/40 lg:block">{sidebar}</aside>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <BrandLogo className="w-[150px] sm:w-[150px]" />
          <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="grid size-10 place-items-center rounded-full bg-accent"><Menu className="size-5" /></button>
        </header>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="left" className="w-[290px] max-w-[85vw] p-0 lg:hidden"><SheetTitle className="sr-only">Salon navigation</SheetTitle><SheetDescription className="sr-only">Switch locations or open a workspace page.</SheetDescription>{sidebar}</SheetContent></Sheet>
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10"><Outlet /></main>
      </div>
    </LocationCtx.Provider>
  );
}

function LocationSwitcher({ locations, active, onPick }: { locations: Location[]; active: Location; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="glass flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left">
        <span className="bg-brand grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold text-primary-foreground">{(active.name || "S")[0]}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{active.name || "Your salon"}</span>
          <span className="block truncate text-xs text-muted-foreground">{cityLine(active.address)}</span></span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="animate-rise absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border border-border bg-popover p-1.5 shadow-glow">
          <div className="px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">Locations</div>
          {locations.map((l) => (
            <button key={l.id} onClick={() => { onPick(l.id); setOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-accent">
              <span className="min-w-0 flex-1"><span className="block truncate">{l.name || "Your salon"}</span><span className="block truncate text-xs text-muted-foreground">{cityLine(l.address)} · {l.role}</span></span>
              {l.id === active.id && <Check className="size-4 text-violet" />}
            </button>
          ))}
          <div className={cn("mt-1 flex items-center gap-2 border-t border-border px-2.5 pt-2 pb-1.5 text-xs text-muted-foreground")}>
            <Plus className="size-3.5" /> Adding a location? Contact Salon Pro Agent support.
          </div>
        </div>
      )}
    </div>
  );
}
