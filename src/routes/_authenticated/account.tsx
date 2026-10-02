import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, AlertCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { loadOrCreateSalon, loadPhoneSetup, type Salon } from "@/lib/salon-data";
import { voices } from "@/lib/voices";
import { launchSalon } from "@/lib/setup.functions";
import { checkSetupStatus, setupTemporaryNumber } from "@/lib/phone.functions";
import { formatUsNumber, normalizeUsNumber } from "@/lib/phone-format";
import { setupMessage, type PhoneSetup } from "@/lib/phone-status";
import { TestCall } from "@/components/nd/TestCall";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My salon status — NailDesk Pro" },
      { name: "description", content: "Track your NailDesk Pro receptionist, phone number and texting setup." },
      { property: "og:title", content: "My salon status — NailDesk Pro" },
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
    setSalon(r.salon); setCount(r.services.length);
    setSetup(await loadPhoneSetup(r.salon.id));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (!salon) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></div>;

  async function rebuild() {
    setBusy("build"); setMsg(null);
    const r = await launch({ data: { idempotencyKey: buildKey.current } });
    if (r.status === "failed" || r.status === "done") buildKey.current = crypto.randomUUID();
    if (r.error) setMsg(r.error);
    await refresh(); setBusy(null);
  }
  async function getNumber() {
    if (!confirm("NailDesk will reserve a local phone number for your receptionist so you can start testing. Continue?")) return;
    setBusy("number"); setMsg(null);
    const r = await reserve({ data: { idempotencyKey: numberKey.current } });
    if (r.status === "failed") { numberKey.current = crypto.randomUUID(); setMsg(setupMessage(r.code)); }
    else if (r.status === "needs_review") setMsg(setupMessage(r.code || "unconfirmed"));
    await refresh(); setBusy(null);
  }
  async function recheck() {
    setBusy("check"); setMsg(null);
    await check(); await refresh(); setBusy(null);
  }

  const launched = salon.status !== "draft";
  const voice = voices.find((v) => v.id === salon.voice);
  const business = normalizeUsNumber(salon.phone);
  const agentState = setup?.agent_status ?? (salon.has_receptionist ? "ready" : "none");
  const numState = setup?.temp_number_status ?? (salon.phone_number ? "active" : "none");
  const needsReview = agentState === "needs_review" || numState === "needs_review" || agentState === "in_progress" || numState === "in_progress";

  const agentRow: Row = salon.has_receptionist ? ["Receptionist", "Ready — try a test call below", "done"]
    : agentState === "in_progress" ? ["Receptionist", "Building…", "wait"]
    : agentState === "needs_review" ? ["Receptionist", setupMessage(setup?.agent_error || "unconfirmed"), "alert"]
    : agentState === "failed" ? ["Receptionist", setupMessage(setup?.agent_error || ""), "alert"]
    : ["Receptionist", launched ? "Not built yet" : "Launch from setup to start", "todo"];

  const numberRow: Row = salon.phone_number ? ["Temporary NailDesk number", `${formatUsNumber(salon.phone_number)} — set up`, "done"]
    : numState === "in_progress" ? ["Temporary NailDesk number", "Setting up…", "wait"]
    : numState === "needs_review" ? ["Temporary NailDesk number", setupMessage(setup?.temp_number_error || "unconfirmed"), "alert"]
    : numState === "failed" ? ["Temporary NailDesk number", setupMessage(setup?.temp_number_error || ""), "alert"]
    : ["Temporary NailDesk number", salon.has_receptionist ? "Not set up yet" : "After your receptionist is ready", "todo"];

  const items: Row[] = [
    ["Salon details", salon.name || "Not added yet", salon.name ? "done" : "todo"],
    ["Services", `${count} services`, count ? "done" : "todo"],
    ["Receptionist voice", voice?.name ?? "—", "done"],
    agentRow,
    ["Your salon number", business ? `${formatUsNumber(business)} — moving it to NailDesk hasn't been checked yet` : "Add your current number in setup", business ? "wait" : "todo"],
    numberRow,
    ["Call test", setup?.voice_status === "verified" ? "Confirmed" : "Not confirmed yet", setup?.voice_status === "verified" ? "done" : "todo"],
    ["Call forwarding", setup?.forwarding_status === "verified" ? "Confirmed" : "Not set up yet", setup?.forwarding_status === "verified" ? "done" : "todo"],
    ["Texting", setup?.texting_status === "submitted" ? "Registration submitted" : setup?.texting_status === "approved" ? "Approved" : "Not started", setup?.texting_status === "approved" ? "done" : "todo"],
  ];

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="font-semibold tracking-tight">NailDesk Pro</Link>
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">{salon.name || "Your salon"}</h1>
        <p className="mt-2 text-muted-foreground">{launched ? "Here's where your NailDesk setup stands." : "Finish setup to launch your receptionist."}</p>
        <ul className="glass mt-8 divide-y divide-border rounded-[28px]">
          {items.map(([t, d, s]) => (
            <li key={t} className="flex items-center gap-4 p-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent">
                {s === "done" ? <Check className="size-4 text-success" /> : s === "wait" ? <Clock className="size-4" /> : s === "alert" ? <AlertCircle className="size-4 text-destructive" /> : <span className="size-2 rounded-full bg-muted-foreground" />}
              </span>
              <div><div className="font-medium">{t}</div><div className="text-sm text-muted-foreground">{d}</div></div>
            </li>
          ))}
        </ul>
        {msg && <p className="mt-4 text-sm text-destructive">{msg}</p>}
        {salon.has_receptionist && <TestCall />}
        <div className="mt-6 flex flex-wrap gap-3">
          {salon.has_receptionist && !salon.phone_number && (numState === "none" || numState === "failed") && (
            <button onClick={getNumber} disabled={!!busy} className="bg-brand inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
              {busy === "number" && <Loader2 className="size-4 animate-spin" />} Set up my temporary NailDesk number
            </button>
          )}
          {needsReview && (
            <button onClick={recheck} disabled={!!busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-medium">
              {busy === "check" && <Loader2 className="size-4 animate-spin" />} Check status
            </button>
          )}
          {launched && agentState !== "in_progress" && agentState !== "needs_review" && (
            <button onClick={rebuild} disabled={!!busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-medium">
              {busy === "build" && <Loader2 className="size-4 animate-spin" />}{salon.has_receptionist ? "Update receptionist with latest info" : "Build my receptionist"}
            </button>
          )}
          <Link to="/setup" className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">{launched ? "Edit setup" : "Continue setup"}</Link>
        </div>
      </div>
    </div>
  );
}
