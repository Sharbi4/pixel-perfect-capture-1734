import { GoogleCalendarConnect } from "./GoogleCalendarConnect";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CreditCard,
  Phone,
  Plug,
  RefreshCw,
} from "lucide-react";
import { useActiveLocation } from "./location-context";
import { supabase } from "@/integrations/supabase/client";
import { getBillingSummary } from "@/lib/billing.functions";
import { getPlan } from "@/lib/pricing";
import { integrations, contact } from "@/lib/site-content";
import { loadPhoneSetup } from "@/lib/salon-data";
import type { PhoneSetup } from "@/lib/phone-status";
const card = "rounded-[24px] border border-border bg-surface/50 p-6";
const action =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm hover:bg-accent";
function Heading({ title, body }: { title: string; body: string }) {
  const { location } = useActiveLocation();
  return (
    <>
      <p className="text-sm text-muted-foreground">{location.name || "Your salon"}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p>
    </>
  );
}
export function DashboardIntegrations() {
  const [revision, setRevision] = useState(0);
  const { location } = useActiveLocation();
  const [connection, setConnection] = useState<{ provider: string; eligible: boolean } | null>(
      null,
    ),
    [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    setConnection(null);
    setErr("");
    supabase
      .from("salons")
      .select("booking_provider,plan_tier,scheduling_addon")
      .eq("id", location.id)
      .single()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) {
          setErr("We couldn't load your calendar settings.");
          return;
        }
        setConnection({
          provider: data.booking_provider,
          eligible: data.plan_tier !== "essential" || data.scheduling_addon,
        });
      });
    return () => {
      live = false;
    };
  }, [location.id, revision]);
  return (
    <div className="mx-auto max-w-6xl">
      <Heading
        title="Integrations"
        body="Your calendar and communication connections, with clear status for this location."
      />
      {err && (
        <p role="alert" className="mt-6 text-destructive">
          {err}
        </p>
      )}
      <div className="mt-8">
        <GoogleCalendarConnect
          salonId={location.id}
          canEdit={location.role === "owner" || location.role === "manager"}
          onChanged={() => setRevision((n) => n + 1)}
        />
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {integrations
          .filter((x) => x.name !== "Google Calendar")
          .map((x, i) => (
            <section key={x.name} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Plug className="size-5 text-violet" />
                <span className="rounded-full bg-accent px-3 py-1 text-xs">
                  {i === 0
                    ? connection
                      ? connection.provider === "salon_pro" && connection.eligible
                        ? "Native calendar selected"
                        : "Not active for this location"
                      : "Checking…"
                    : x.status}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-medium">{x.name}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{x.description}</p>
              {i === 0 ? (
                <a href="/dashboard/appointments" className={action + " mt-5"}>
                  Open calendar
                  <ArrowUpRight className="size-4" />
                </a>
              ) : (
                <p className="mt-5 text-xs text-muted-foreground">
                  No connection is active. Availability will be announced before setup opens.
                </p>
              )}
            </section>
          ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Google Calendar requires authorization for this location. The other external providers shown
        above are still in development.
      </p>
    </div>
  );
}
export function DashboardPhones() {
  const { location } = useActiveLocation();
  const [state, setState] = useState<PhoneSetup | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setLoaded(false);
    setState(null);
    setError("");
    loadPhoneSetup(location.id)
      .then((s) => {
        if (live) {
          setState(s);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (live) setError("We couldn't retrieve phone setup.");
      });
    return () => {
      live = false;
    };
  }, [location.id]);
  const items: [string, string][] = [
    ["Agent number", location.phone_number || "Not assigned"],
    ["Business number", state?.business_number || "Not added"],
    ["Voice test", state?.voice_status || "Not verified"],
    ["Call forwarding", state?.forwarding_status || "Not verified"],
    ["Business texting", state?.texting_status || "Not registered"],
    ["Portability check", state?.portability_status || "Not checked"],
  ];
  return (
    <div className="mx-auto max-w-6xl">
      <Heading
        title="Phone numbers"
        body="Keep your clients' familiar number while you prepare your agent line and verify routing."
      />
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className={card}>
          <Phone className="size-6 text-violet" />
          <h2 className="mt-5 text-xl font-medium">Your connection status</h2>
          {error ? (
            <p role="alert" className="mt-4 text-destructive">
              {error}
            </p>
          ) : !loaded ? (
            <p className="mt-5 text-muted-foreground">Loading…</p>
          ) : (
            <dl className="mt-6 divide-y divide-border">
              {items.map(([k, v]) => (
                <div key={k} className="flex flex-wrap justify-between gap-3 py-4 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="capitalize">{v.replaceAll("_", " ")}</dd>
                </div>
              ))}
            </dl>
          )}
          {location.role === "owner" && (
            <a href="/account" className={action + " mt-6"}>
              Manage phone setup
              <ArrowUpRight className="size-4" />
            </a>
          )}
        </section>
        <aside className={card}>
          <h2 className="text-xl font-medium">A smooth switch starts here.</h2>
          <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Complete paid setup and reserve your agent number.</li>
            <li>Make a real test call and check the greeting and routing.</li>
            <li>Follow forwarding instructions with your current carrier.</li>
            <li>Wait for texting approval before sending business messages.</li>
          </ol>
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Porting needs a separate provider approval. Keep your existing line active until the
            transfer is confirmed.
          </p>
          <a href="/contact" className={action + " mt-6"}>
            Get connection help
          </a>
        </aside>
      </div>
    </div>
  );
}
type Billing = Awaited<ReturnType<typeof getBillingSummary>>;
export function DashboardBilling() {
  const { location } = useActiveLocation(),
    load = useServerFn(getBillingSummary);
  const [result, setResult] = useState<Billing | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setResult(null);
    setError("");
    if (location.role === "owner")
      load({ data: { salonId: location.id } })
        .then((r) => {
          if (live) setResult(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [location.id, location.role, load]);
  const p = getPlan(result?.planTier);
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n / 100);
  return (
    <div className="mx-auto max-w-6xl">
      <Heading
        title="Plan & billing"
        body="View confirmed purchases and your access period. Our team can help with plan changes, receipts or cancellation."
      />
      {location.role !== "owner" ? (
        <p className={card + " mt-8"}>Billing is available to the salon owner.</p>
      ) : error ? (
        <p role="alert" className={card + " mt-8 text-destructive"}>
          {error}
        </p>
      ) : !result ? (
        <p className="mt-8 text-muted-foreground">Loading billing…</p>
      ) : (
        <>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <section className={card}>
              <CreditCard className="size-6 text-violet" />
              <h2 className="mt-5 text-2xl font-semibold">
                {result.purchases.some((x) => x.state === "paid")
                  ? p.name
                  : "No subscription purchase confirmed"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {result.paidUntil
                  ? "Paid access through " +
                    new Date(result.paidUntil).toLocaleDateString() +
                    ". Subscription status and future invoices are managed in Square."
                  : "Complete checkout to activate a subscription. A historical setup payment is listed separately below."}
              </p>
              <p className="mt-5 text-sm">
                {p.minutes.toLocaleString()} voice minutes · {p.sms.toLocaleString()} SMS segments
                on {p.name}
              </p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Usage billing is not estimated from inbox counts. Contact support for metered usage
                and renewal invoices.
              </p>
            </section>
            <section className={card}>
              <h2 className="text-xl font-medium">Need to make a change?</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                For a plan change, payment method update or cancellation, contact support with your
                salon name and account email. Never include card numbers.
              </p>
              <a
                href={"mailto:" + contact.email + "?subject=Salon%20Pro%20Agent%20billing"}
                className={action + " mt-6"}
              >
                Contact billing
                <ArrowUpRight className="size-4" />
              </a>
              <a href="/cancellation-refunds" className="mt-4 block text-sm text-violet underline">
                Cancellation & refund policy
              </a>
            </section>
          </div>
          <section className={card + " mt-5"}>
            <h2 className="text-xl font-medium">Purchase history</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Initial purchases and historical setup payments. Renewal invoice copies are available
              through support.
            </p>
            {!result.purchases.length && !result.legacy.length ? (
              <p className="mt-8 text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="mt-5 divide-y divide-border">
                {result.purchases.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-3 py-4 text-sm">
                    <span>
                      {r.plan_name}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()} ·{" "}
                        {r.state.replaceAll("_", " ")}
                      </span>
                    </span>
                    <span>{money(r.total_cents)}</span>
                  </li>
                ))}
                {result.legacy.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-3 py-4 text-sm">
                    <span>
                      Historical {r.kind} payment
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()} · {r.status}
                      </span>
                    </span>
                    <span>{money(r.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

type CallMetric = { started_at: string; duration_secs: number; outcome: string; status: string };
export function DashboardAnalytics() {
  const { location } = useActiveLocation();
  const [rows, setRows] = useState<CallMetric[] | null>(null),
    [error, setError] = useState(""),
    [days, setDays] = useState(30);
  useEffect(() => {
    let live = true;
    setRows(null);
    setError("");
    supabase
      .from("calls")
      .select("started_at,duration_secs,outcome,status")
      .eq("salon_id", location.id)
      .gte("started_at", new Date(Date.now() - days * 86400000).toISOString())
      .order("started_at", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setError("Call analytics couldn't load. Refresh to try again.");
        else setRows(data ?? []);
      });
    return () => {
      live = false;
    };
  }, [location.id, days]);
  const groups: Record<string, number> = {};
  for (const r of rows ?? [])
    groups[r.outcome || "Not classified"] = (groups[r.outcome || "Not classified"] ?? 0) + 1;
  const duration = (rows ?? []).reduce((sum, x) => sum + x.duration_secs, 0);
  const chart = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  function csv() {
    const escape = (s: string) => '"' + s.replaceAll('"', '""') + '"';
    const content =
      "Outcome,Calls\n" + chart.map(([outcome, count]) => escape(outcome) + "," + count).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "salon-call-outcomes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="mx-auto max-w-6xl">
      <Heading
        title="Call analytics"
        body="Understand your recent conversations using saved call activity for this location."
      />
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Period{" "}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="ml-3 rounded-xl border border-border bg-background px-4 py-3"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
        <button disabled={!rows?.length} onClick={csv} className={action + " disabled:opacity-40"}>
          Export outcomes CSV
        </button>
      </div>
      {error ? (
        <p role="alert" className={card + " mt-7 text-destructive"}>
          {error}
        </p>
      ) : !rows ? (
        <p className="mt-8 text-muted-foreground">Loading call history…</p>
      ) : (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              ["Recorded calls", rows.length.toLocaleString()],
              ["Conversation minutes", (duration / 60).toFixed(1)],
              ["Average call", (rows.length ? duration / 60 / rows.length : 0).toFixed(1) + " min"],
            ].map(([title, value]) => (
              <section key={title} className={card}>
                <h2 className="text-sm text-muted-foreground">{title}</h2>
                <p className="mt-4 text-3xl font-semibold">{value}</p>
              </section>
            ))}
          </div>
          <section className={card + " mt-5"}>
            <h2 className="text-xl font-medium">Conversation outcomes</h2>
            {!chart.length ? (
              <p className="mt-8 text-sm text-muted-foreground">
                No saved calls in this period. Once your agent starts receiving calls, outcomes will
                appear here.
              </p>
            ) : (
              <ul className="mt-6 space-y-5">
                {chart.map(([name, count]) => (
                  <li key={name}>
                    <div className="mb-2 flex justify-between gap-4 text-sm">
                      <span className="capitalize">{name.replaceAll("_", " ")}</span>
                      <span>
                        {count} · {Math.round((count / rows.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-accent">
                      <div
                        className="h-2 rounded-full bg-violet"
                        style={{ width: (count / rows.length) * 100 + "%" }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            Based on up to 1,000 most recent saved calls in the selected period. Call activity
            updates when your team syncs the Calls page. Conversation minutes are informational and
            may differ from billed voice usage. Cross-location reporting and conversion attribution
            are planned.
          </p>
          <a href="/dashboard/calls" className={action + " mt-5"}>
            Open calls & sync
            <RefreshCw className="size-4" />
          </a>
        </>
      )}
    </div>
  );
}
