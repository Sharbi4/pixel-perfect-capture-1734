import { Check, ArrowUpRight, Phone, MessageSquare, MapPin, Users } from "lucide-react";
import { plans, setup, usageRates, comparison, type Tier } from "@/lib/pricing";
import { siteButton, siteGhost } from "./SiteShell";
export function PlanCards({
  selected,
  onSelect,
}: {
  selected?: Tier;
  onSelect?: (tier: Tier) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((p) => (
        <article
          key={p.id}
          className={
            "relative flex flex-col rounded-[28px] border p-6 sm:p-8 " +
            (selected === p.id
              ? "border-violet bg-violet/10 ring-1 ring-violet/50"
              : p.highlight
                ? "border-violet/40 bg-gradient-to-b from-violet/10 to-surface"
                : "border-border bg-surface/60")
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{p.name}</h2>
            {p.highlight && (
              <span className="rounded-full border border-violet/30 bg-violet/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider">
                Best for busy salons
              </span>
            )}
          </div>
          <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{p.blurb}</p>
          <p className="mt-6">
            <span className="text-5xl font-semibold tracking-[-.04em]">{p.price}</span>
            <span className="ml-1 text-sm text-muted-foreground">/mo</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            + {setup.price} one-time setup & launch
          </p>
          <div className="my-7 grid grid-cols-2 gap-x-3 gap-y-5 border-y border-border py-6">
            {[
              [Phone, p.minutes.toLocaleString(), "AI minutes"],
              [MessageSquare, p.sms.toLocaleString(), "SMS segments"],
              [MapPin, p.locations, String(p.locations === 1 ? "location" : "locations")],
              [Users, p.users, "team users"],
            ].map(([Icon, value, label]) => {
              const I = Icon as typeof Phone;
              return (
                <div key={String(label)}>
                  <I className="mb-2 size-4 text-muted-foreground" />
                  <span className="text-xl font-medium">{String(value)}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{String(label)}</span>
                </div>
              );
            })}
          </div>
          <ul className="mb-8 space-y-3">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {f}
              </li>
            ))}
          </ul>
          {onSelect ? (
            <button
              type="button"
              aria-pressed={selected === p.id}
              onClick={() => onSelect(p.id)}
              className={(p.highlight ? siteButton : siteGhost) + " mt-auto w-full"}
            >
              {selected === p.id ? "Selected" : p.cta}
              {selected === p.id ? (
                <Check className="size-4" />
              ) : (
                <ArrowUpRight className="size-4" />
              )}
            </button>
          ) : (
            <a
              href={"/get-started?plan=" + p.id}
              className={(p.highlight ? siteButton : siteGhost) + " mt-auto w-full"}
            >
              {p.cta}
              <ArrowUpRight className="size-4" />
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
export function PricingNotes() {
  return (
    <div className="mt-8 rounded-2xl border border-border p-6">
      <div className="grid gap-6 sm:grid-cols-3">
        {[
          ["Additional AI voice", "$" + (usageRates.voiceCents / 100).toFixed(2) + " / minute"],
          ["Additional SMS", "$" + (usageRates.smsCents / 100).toFixed(2) + " / segment"],
          ["Additional location", "$" + usageRates.locationCents / 100 + " / month"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-lg font-medium">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        Monthly allowances are shared across your plan's included locations. Long texts, emojis and
        some languages can use multiple SMS segments. Additional services require confirmation; they
        are not automatically added at checkout. Calendar integrations, messaging and deposit
        collection depend on availability, configuration and provider approval. Payment processing
        fees for your salon's customer deposits apply separately. Advanced routing and
        cross-location reporting are still being developed; confirm your required workflows with us
        before purchasing.
      </p>
    </div>
  );
}
export function PlanComparison() {
  return (
    <div
      className="mt-12 overflow-x-auto rounded-2xl border border-border"
      tabIndex={0}
      role="region"
      aria-label="Scrollable plan comparison"
    >
      <table className="w-full min-w-[600px] text-sm">
        <caption className="p-5 text-left text-xl font-semibold">
          The details, side by side.
        </caption>
        <thead>
          <tr className="border-y border-border bg-surface">
            <th scope="col" className="p-5 text-left">
              What’s included
            </th>
            {plans.map((p) => (
              <th scope="col" key={p.id} className="p-5">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.map(([label, ...values]) => (
            <tr key={label} className="border-b border-border last:border-0">
              <th scope="row" className="p-5 text-left font-normal text-muted-foreground">
                {label}
              </th>
              {values.map((v, i) => (
                <td key={i} className="p-5 text-center">
                  {v === true ? (
                    <>
                      <Check aria-hidden className="mx-auto size-4 text-success" />
                      <span className="sr-only">Included</span>
                    </>
                  ) : v === false ? (
                    <span aria-label="Not included">—</span>
                  ) : (
                    v
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
