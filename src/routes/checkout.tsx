import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, LockKeyhole, ArrowRight } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand/Brand";
import { Field, inputClass, buttonClass } from "@/components/setup/Fields";
import {
  buyerSchema,
  previewKey,
  previewSchema,
  type Buyer,
  type CheckoutStatus,
  type PreviewDraft,
} from "@/lib/checkout-model";
import { getPlan, setup, type Tier } from "@/lib/pricing";
import { SiteShell } from "@/components/site/SiteShell";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Secure checkout — Salon Pro Agent" }] }),
  component: Checkout,
});
type Card = {
  attach: (selector: string) => Promise<void>;
  destroy: () => Promise<boolean>;
  tokenize: (details: unknown) => Promise<{ status: string; token?: string }>;
};
type Square = { payments: (app: string, location: string) => { card: () => Promise<Card> } };
type Config = {
  tier?: Tier;
  available: boolean;
  applicationId?: string;
  locationId?: string;
  environment?: string;
  totalCents?: number;
  monthlyCents?: number;
  setupCents?: number;
  nextBillingDate?: string;
  purchase?: CheckoutStatus | null;
};
declare global {
  interface Window {
    Square?: Square;
  }
}
let sdk: Promise<void> | undefined;
function loadSdk(environment: string) {
  sdk ??= new Promise((resolve, reject) => {
    if (window.Square) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src =
      environment === "sandbox"
        ? "https://sandbox.web.squarecdn.com/v1/square.js"
        : "https://web.squarecdn.com/v1/square.js";
    script.onload = () => resolve();
    script.onerror = () => {
      sdk = undefined;
      reject(Error("The secure payment form could not load. Please reload."));
    };
    document.head.appendChild(script);
  });
  return sdk;
}
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
function Checkout() {
  const [preview, setPreview] = useState<PreviewDraft | null>(null),
    [config, setConfig] = useState<Config | null>(null),
    [purchase, setPurchase] = useState<CheckoutStatus | null>(null);
  const [buyer, setBuyer] = useState<Buyer>({
      email: "",
      firstName: "",
      lastName: "",
      address: "",
      city: "",
      state: "",
      zip: "",
    }),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [cardReady, setCardReady] = useState(false),
    [error, setError] = useState("");
  const card = useRef<Card | null>(null);
  const selected = getPlan(config?.tier ?? preview?.tier);
  const plan = {
    ...selected,
    monthlyCents: purchase?.monthlyCents ?? config?.monthlyCents ?? selected.monthlyCents,
    setupCents: purchase
      ? purchase.totalCents - purchase.monthlyCents
      : (config?.setupCents ?? setup.cents),
  };
  useEffect(() => {
    let active = true;
    let tier: Tier = getPlan(new URLSearchParams(window.location.search).get("plan")).id;
    try {
      const r = previewSchema.safeParse(JSON.parse(localStorage.getItem(previewKey) || "null"));
      if (r.success) {
        tier = r.data.tier;
        setPreview(r.data);
      }
    } catch {}
    fetch("/api/public/checkout?plan=" + tier)
      .then((r) => r.json())
      .then((c: Config) => {
        if (active) {
          setConfig(c);
          setPurchase(c.purchase ?? null);
          if (c.tier) setPreview((p) => (p ? { ...p, tier: c.tier! } : p));
        }
      })
      .catch(() => {
        if (active) setConfig({ available: false });
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!config?.available || purchase?.state === "paid" || purchase?.canResume) return;
    let active = true,
      instance: Card | null = null;
    (async () => {
      try {
        await loadSdk(config.environment!);
        instance = await window.Square!.payments(config.applicationId!, config.locationId!).card();
        if (!active) {
          await instance.destroy();
          return;
        }
        card.current = instance;
        await instance.attach("#square-card");
        if (active) setCardReady(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load the payment form.");
      }
    })();
    return () => {
      active = false;
      setCardReady(false);
      card.current = null;
      void instance?.destroy();
    };
  }, [config, purchase?.state, purchase?.canResume]);
  async function post(data: unknown) {
    const r = await fetch("/api/public/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await r.json();
    if (!r.ok) throw Error(body.error || "Checkout needs a status check.");
    return body as { purchase: CheckoutStatus };
  }
  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (purchase?.canResume) {
        const r = await post({ action: "submit" });
        setPurchase(r.purchase);
        return;
      }
      if (!preview || !config?.available || !card.current || !consent)
        throw Error("Complete your details and authorize the payment to continue.");
      const b = buyerSchema.parse(buyer);
      const started = await post({
        action: "start",
        buyer: b,
        preview,
        consent: true,
        nextBillingDate: config.nextBillingDate,
      });
      if (started.purchase.state !== "draft") {
        setPurchase(started.purchase);
        return;
      }
      const result = await card.current.tokenize({
        amount: ((config.totalCents ?? 0) / 100).toFixed(2),
        currencyCode: "USD",
        intent: "CHARGE_AND_STORE",
        customerInitiated: true,
        sellerKeyedIn: false,
        billingContact: {
          givenName: b.firstName,
          familyName: b.lastName,
          email: b.email,
          addressLines: [b.address],
          city: b.city,
          state: b.state,
          postalCode: b.zip,
          countryCode: "US",
        },
      });
      if (result.status !== "OK" || !result.token)
        throw Error(
          "Please check your card details and try again. No payment was submitted by this form.",
        );
      const finished = await post({ action: "submit", source: result.token });
      setPurchase(finished.purchase);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Payment could not be confirmed. Please check its status before trying again.",
      );
      try {
        const r = await fetch("/api/public/checkout?plan=" + selected.id);
        const c: Config = await r.json();
        if (c.purchase) setPurchase(c.purchase);
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  const f = (key: keyof Buyer, label: string, type = "text") => (
    <Field label={label}>
      <input
        required
        autoComplete={key === "email" ? "email" : undefined}
        type={type}
        className={`${inputClass} checkout-input`}
        value={buyer[key]}
        onChange={(e) => setBuyer({ ...buyer, [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <SiteShell>
      <div className="checkout-stage min-h-screen px-5 py-10 sm:py-16">
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-6">
            <BrandLogo className="w-[220px] sm:w-[250px]" />
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" />
              Secure checkout
            </span>
          </div>
          <div className="grid items-start gap-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-12">
            <aside className="lg:sticky lg:top-8">
              <p className="text-xs uppercase tracking-[.16em] text-muted-foreground">
                Get started today
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.12] tracking-[-.045em] sm:text-5xl">
                Your front desk.
                <br />
                <span className="text-gradient">Ready for what's next.</span>
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                {preview?.name || "Your salon"} gets a guided setup, a receptionist to make its own,
                and support through launch.
              </p>
              <div className="checkout-glass mt-8 rounded-[28px] p-6 sm:p-7">
                <p className="text-xs uppercase tracking-[.14em] text-muted-foreground">
                  Your plan
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <span className="checkout-mark grid size-12 place-items-center rounded-2xl">
                    <BrandMark className="size-8" />
                  </span>
                  <div>
                    <p className="text-xl font-semibold">{plan.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your Salon Pro Agent membership
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {selected.minutes.toLocaleString()} voice minutes ·{" "}
                  {selected.sms.toLocaleString()} SMS segments · {selected.locations}{" "}
                  {selected.locations === 1 ? "location" : "locations"}
                </p>
                <dl className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Custom setup & launch</dt>
                    <dd>{money(plan.setupCents)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">First month</dt>
                    <dd>{money(plan.monthlyCents)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5 font-medium [&>dd]:text-2xl [&>dd]:tracking-tight">
                    <dt>Total today</dt>
                    <dd>{money(plan.setupCents + plan.monthlyCents)}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Then {money(plan.monthlyCents)}/month
                  {config?.nextBillingDate ? ` starting ${config.nextBillingDate}` : ""}. The setup
                  fee is charged once.
                </p>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <LockKeyhole className="size-4" />
                Card details are collected securely by Square when checkout is available.
              </p>
              {!!preview?.addonInterests.length && (
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Launch-team requests:{" "}
                  {preview.addonInterests
                    .map((x) => (x === "scheduling" ? "Native Scheduling" : "Additional location"))
                    .join(", ")}
                  . These requests are excluded from today’s total and do not activate additional
                  billing.
                </p>
              )}
              <Link to="/get-started" className="mt-6 inline-block text-sm text-muted-foreground">
                Back to my preview
              </Link>
            </aside>
            <section
              aria-label="Secure payment"
              className="checkout-glass checkout-payment min-w-0 rounded-[32px] p-6 sm:p-9"
            >
              <div className="mb-7 flex items-center gap-3 border-b border-white/10 pb-6">
                <span className="checkout-mark grid size-10 shrink-0 place-items-center rounded-xl">
                  <BrandMark className="size-6" />
                </span>
                <div>
                  <p className="text-sm font-medium">Salon Pro Agent</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A better welcome starts here.
                  </p>
                </div>
              </div>
              {!config ? (
                <div role="status" className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Loading secure checkout…
                </div>
              ) : purchase?.state === "paid" ? (
                <>
                  <div className="grid size-12 place-items-center rounded-full bg-success/10 text-success">
                    <Check />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold">Payment confirmed.</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Now secure your account using {purchase.email}. Your business details will be
                    ready when you finish signing in.
                  </p>
                  <Link
                    to="/complete-account"
                    className={`${buttonClass} bg-brand mt-6 w-full text-white`}
                  >
                    Finish my account
                    <ArrowRight className="size-4" />
                  </Link>
                  {config.environment === "sandbox" && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Sandbox payment: no real funds collected and no live phone access unlocked.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold">Payment information</h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Enter your billing details to get started.
                  </p>
                  {!config.available && (
                    <div
                      role="status"
                      className="mt-5 rounded-xl border border-violet/30 bg-violet/10 p-4 text-sm leading-relaxed"
                    >
                      Checkout isn't open yet. Your preview is saved in this browser. Payments will
                      become available once our Square connection is ready.{" "}
                      <a href="/contact" className="underline">
                        Contact us for help getting started.
                      </a>
                    </div>
                  )}
                  {config.environment === "sandbox" && (
                    <p className="mt-4 rounded-xl bg-violet/10 p-3 text-sm">
                      Sandbox mode · use Square test cards only.
                    </p>
                  )}
                  {purchase && purchase.state !== "draft" ? (
                    <div className="mt-6">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {purchase.error ||
                          "Your payment is being confirmed. You won't be charged again when you resume this checkout."}
                      </p>
                      {purchase.canResume && (
                        <button
                          onClick={() => void pay({ preventDefault: () => {} } as React.FormEvent)}
                          disabled={busy}
                          className={`${buttonClass} mt-5 w-full`}
                        >
                          {busy ? <Loader2 className="size-4 animate-spin" /> : null}Resume checkout
                        </button>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={pay} className="mt-7">
                      <fieldset
                        disabled={busy || !config.available}
                        className="grid min-w-0 gap-4 sm:grid-cols-2"
                      >
                        <div className="sm:col-span-2">{f("email", "Email", "email")}</div>
                        {f("firstName", "First name")}
                        {f("lastName", "Last name")}
                        <div className="sm:col-span-2">
                          {f("address", "Billing street address")}
                        </div>
                        {f("city", "City")}
                        {f("state", "State (2 letters)")}
                        {f("zip", "ZIP code")}
                        <p className="self-center text-xs text-muted-foreground">
                          United States · USD
                        </p>
                      </fieldset>
                      <div
                        id="square-card"
                        className="checkout-card-field mt-6 min-h-12 rounded-2xl border border-white/10 bg-black/15 p-4"
                      />
                      <label className="mt-5 flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                        <input
                          disabled={!config.available || busy}
                          type="checkbox"
                          required
                          className="mt-1 size-4 shrink-0"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                        />
                        <span>
                          I authorize {money(plan.setupCents + plan.monthlyCents)} today and{" "}
                          {money(plan.monthlyCents)} monthly starting{" "}
                          {config.nextBillingDate || "on the date shown before payment"}. I
                          authorize Square to save my card for this subscription. I agree to the{" "}
                          <a href="/terms" target="_blank" rel="noreferrer" className="underline">
                            Terms
                          </a>{" "}
                          and have read the{" "}
                          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
                            Privacy Policy
                          </a>
                          . I can request cancellation before renewal at support@salonagentai.com.{" "}
                          <a
                            href="/cancellation-refunds"
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Cancellation & refunds
                          </a>
                          .
                        </span>
                      </label>
                      <button
                        disabled={!config.available || !preview || !cardReady || !consent || busy}
                        className="checkout-pay-button bg-brand mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <LockKeyhole className="size-4" />
                        )}
                        Pay {money(plan.setupCents + plan.monthlyCents)} & continue
                      </button>
                      {!preview && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Start with your business preview before checking out.
                        </p>
                      )}
                    </form>
                  )}
                </>
              )}
              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <LockKeyhole className="size-3.5" />
                  Payments by Square
                </span>
                <a
                  href="mailto:support@salonagentai.com"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Questions? We’re here to help.
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
