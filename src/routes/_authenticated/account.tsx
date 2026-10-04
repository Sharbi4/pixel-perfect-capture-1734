import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, AlertCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { loadOrCreateSalon, loadPhoneSetup, type Salon } from "@/lib/salon-data";
import { readOnboarding } from "@/lib/onboarding-model";
import { voices } from "@/lib/voices";
import { launchSalon } from "@/lib/setup.functions";
import { checkSetupStatus, setupTemporaryNumber } from "@/lib/phone.functions";
import { formatUsNumber, normalizeUsNumber } from "@/lib/phone-format";
import { setupMessage, type PhoneSetup } from "@/lib/phone-status";
import { TestCall } from "@/components/nd/TestCall";
import { BrandLogo } from "@/components/brand/Brand";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My salon status — Salon Pro Agent" },
      {
        name: "description",
        content: "Track your Salon Pro Agent receptionist, phone number and texting setup.",
      },
      { property: "og:title", content: "My salon status — Salon Pro Agent" },
      { property: "og:description", content: "See where your AI receptionist setup stands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

type Row = [string, string, "done" | "wait" | "todo" | "alert"];

function AccountPage() {
  const [salon, setSalon] = useState<Salon | null>(null);
  const [setup, setSetup] = useState<PhoneSetup | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState<null | "build" | "number" | "check">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const launch = useServerFn(launchSalon);
  const reserve = useServerFn(setupTemporaryNumber);
  const check = useServerFn(checkSetupStatus);
  // One key per intentional action; reused if the same action is resubmitted.
  const buildKey = useRef(crypto.randomUUID());
  const numberKey = useRef(crypto.randomUUID());

  const refresh = useCallback(async () => {
    const r = await loadOrCreateSalon();
    setSalon(r.salon);
    setCount(r.services.length);
    setSetup(await loadPhoneSetup(r.salon.id));
  }, []);
  useEffect(() => {
    void refresh().catch(() => setMsg("We couldn't load your salon. Please try again."));
  }, [refresh]);

  if (!salon)
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="text-center">
          {msg ? (
            <>
              <p role="alert">{msg}</p>
              <button
                className="mt-4 rounded-full bg-accent px-6 py-3"
                onClick={() => {
                  setMsg(null);
                  void refresh().catch(() =>
                    setMsg("We couldn't load your salon. Please try again."),
                  );
                }}
              >
                Try again
              </button>
            </>
          ) : (
            <Loader2 className="size-5 animate-spin" />
          )}
        </div>
      </div>
    );

  async function rebuild() {
    setBusy("build");
    setMsg(null);
    try {
      const r = await launch({ data: { idempotencyKey: buildKey.current } });
      if (r.status === "failed" || r.status === "done") buildKey.current = crypto.randomUUID();
      if (r.error) setMsg(r.error);
      await refresh();
    } catch {
      setMsg("We couldn't confirm the result. Check status before trying again.");
    } finally {
      setBusy(null);
    }
  }
  async function getNumber() {
    if (
      !confirm(
        "Salon Pro Agent will reserve a local phone number for your receptionist so you can start testing. Continue?",
      )
    )
      return;
    setBusy("number");
    setMsg(null);
    try {
      const r = await reserve({ data: { idempotencyKey: numberKey.current } });
      if (r.status === "failed") {
        numberKey.current = crypto.randomUUID();
        setMsg(setupMessage(r.code));
      } else if (r.status === "needs_review") setMsg(setupMessage(r.code || "unconfirmed"));
      await refresh();
    } catch {
      setMsg("We couldn't confirm the result. Check status before trying again.");
    } finally {
      setBusy(null);
    }
  }
  async function recheck() {
    setBusy("check");
    setMsg(null);
    try {
      await check();
      await refresh();
    } catch {
      setMsg("We couldn't check your setup just now. Please try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  const preferences = readOnboarding(salon.setup_draft);
  const launched = salon.status !== "draft";
  const voice = voices.find((v) => v.id === salon.voice);
  const business = normalizeUsNumber(salon.phone);
  const agentState = setup?.agent_status ?? (salon.has_receptionist ? "ready" : "none");
  const numState = setup?.temp_number_status ?? (salon.phone_number ? "active" : "none");
  const needsReview =
    agentState === "needs_review" ||
    numState === "needs_review" ||
    agentState === "in_progress" ||
    numState === "in_progress";

  const agentRow: Row = salon.has_receptionist
    ? ["Receptionist", "Ready — try a test call below", "done"]
    : agentState === "in_progress"
      ? ["Receptionist", "Building…", "wait"]
      : agentState === "needs_review"
        ? ["Receptionist", setupMessage(setup?.agent_error || "unconfirmed"), "alert"]
        : agentState === "failed"
          ? ["Receptionist", setupMessage(setup?.agent_error || ""), "alert"]
          : ["Receptionist", launched ? "Not built yet" : "Launch from setup to start", "todo"];

  const numberRow: Row = salon.phone_number
    ? [
        preferences.phoneIntent === "new" ? "Your agent number" : "Temporary agent number",
        `${formatUsNumber(salon.phone_number)} — set up`,
        "done",
      ]
    : numState === "in_progress"
      ? [
          preferences.phoneIntent === "new" ? "Your agent number" : "Temporary agent number",
          "Setting up…",
          "wait",
        ]
      : numState === "needs_review"
        ? [
            preferences.phoneIntent === "new" ? "Your agent number" : "Temporary agent number",
            setupMessage(setup?.temp_number_error || "unconfirmed"),
            "alert",
          ]
        : numState === "failed"
          ? [
              preferences.phoneIntent === "new" ? "Your agent number" : "Temporary agent number",
              setupMessage(setup?.temp_number_error || ""),
              "alert",
            ]
          : [
              preferences.phoneIntent === "new" ? "Your agent number" : "Temporary agent number",
              salon.has_receptionist ? "Not set up yet" : "After your receptionist is ready",
              "todo",
            ];

  const items: Row[] = [
    ["Salon details", salon.name || "Not added yet", salon.name ? "done" : "todo"],
    ["Services", `${count} services`, count ? "done" : "todo"],
    ["Receptionist voice", voice?.name ?? "—", "done"],
    agentRow,
    [
      "Your salon number",
      business
        ? `${formatUsNumber(business)} — ${preferences.phoneIntent === "port" ? "transfer eligibility not checked yet" : "stays with your carrier"}`
        : "New number requested",
      business ? "wait" : "todo",
    ],
    numberRow,
    [
      "Call test",
      setup?.voice_status === "verified" ? "Confirmed" : "Not confirmed yet",
      setup?.voice_status === "verified" ? "done" : "todo",
    ],
    [
      "Call forwarding",
      setup?.forwarding_status === "verified" ? "Confirmed" : "Not set up yet",
      setup?.forwarding_status === "verified" ? "done" : "todo",
    ],
    [
      "Texting",
      setup?.texting_status === "submitted"
        ? "Registration submitted"
        : setup?.texting_status === "approved"
          ? "Approved"
          : "Not started",
      setup?.texting_status === "approved" ? "done" : "todo",
    ],
  ];

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <BrandLogo />
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">
          {salon.name || "Your salon"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {launched
            ? "Here's where your Salon Pro Agent setup stands."
            : "Finish setup to launch your receptionist."}
        </p>
        <ul className="glass mt-8 divide-y divide-border rounded-[28px]">
          {items.map(([t, d, s]) => (
            <li key={t} className="flex items-center gap-4 p-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent">
                {s === "done" ? (
                  <Check className="size-4 text-success" />
                ) : s === "wait" ? (
                  <Clock className="size-4" />
                ) : s === "alert" ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : (
                  <span className="size-2 rounded-full bg-muted-foreground" />
                )}
              </span>
              <div>
                <div className="font-medium">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
            </li>
          ))}
        </ul>
        {msg && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {msg}
          </p>
        )}
        {salon.has_receptionist && salon.phone_number && (
          <section className="glass mt-6 rounded-[28px] p-6">
            <h2 className="font-medium">Test your Salon Pro Agent phone number</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Call this number and test your receptionist before connecting your existing salon
              phone.
            </p>
            <p className="mt-4 text-2xl font-semibold">{formatUsNumber(salon.phone_number)}</p>
            <a
              href={`tel:${salon.phone_number}`}
              className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Call My Salon Pro Agent
            </a>
            <ul className="mt-4 list-inside list-disc text-sm text-muted-foreground">
              <li>Ask about a service or its price.</li>
              <li>Try making an appointment request.</li>
              <li>Ask for a technician.</li>
              <li>Try speaking Vietnamese if you selected it during setup.</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Starting a call does not mark your phone setup as verified.
            </p>
          </section>
        )}
        <section className="mt-6 rounded-[28px] border border-border p-6">
          <h2 className="text-xl font-medium">Your final connection steps</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
            <li>
              Test your agent number. Check service prices, pronunciation and handoff requests.
            </li>
            <li>
              Make a test appointment and verify its time, service and staff member inside your
              connected calendar. Cancel the test afterward.
            </li>
            {preferences.phoneIntent === "new" ? (
              <li>
                Once testing succeeds, use your dedicated number on your website and business
                listings.
              </li>
            ) : preferences.phoneIntent === "port" ? (
              <li>
                Request a portability check with our launch team. Keep your carrier active until the
                transfer is confirmed. You can forward to the temporary number while waiting.
              </li>
            ) : (
              <li>
                Ask your carrier to forward unanswered or all calls to your agent number.
                Instructions depend on your carrier. Call your existing salon number from another
                phone to confirm routing; turn forwarding off with your carrier if needed.
              </li>
            )}
            <li>
              Voice forwarding does not forward SMS. Business texting has its own registration and
              approval.
            </li>
          </ol>
          <a
            href="mailto:support@salonagentai.com?subject=Salon%20phone%20setup%20help"
            className="mt-4 inline-block text-sm underline"
          >
            Get help with forwarding or a number transfer
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            A transfer request or test call does not automatically mark setup as verified.
          </p>
        </section>
        {salon.has_receptionist && <TestCall />}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Open dashboard
          </Link>
          {salon.has_receptionist &&
            !salon.phone_number &&
            (numState === "none" || numState === "failed") && (
              <button
                onClick={getNumber}
                disabled={!!busy}
                className="bg-brand inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {busy === "number" && <Loader2 className="size-4 animate-spin" />} Reserve my agent
                number
              </button>
            )}
          {(needsReview || msg) && (
            <button
              onClick={recheck}
              disabled={!!busy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-medium"
            >
              {busy === "check" && <Loader2 className="size-4 animate-spin" />} Check status
            </button>
          )}
          {launched && agentState !== "in_progress" && agentState !== "needs_review" && (
            <button
              onClick={rebuild}
              disabled={!!busy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-medium"
            >
              {busy === "build" && <Loader2 className="size-4 animate-spin" />}
              {salon.has_receptionist
                ? "Update receptionist with latest info"
                : "Build my receptionist"}
            </button>
          )}
          <Link
            to="/setup"
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            {launched ? "Edit setup" : "Continue setup"}
          </Link>
        </div>
      </div>
    </div>
  );
}
