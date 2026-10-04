import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BrandLogo } from "@/components/brand/Brand";
import { Field, inputClass, buttonClass } from "@/components/setup/Fields";
import { supabase } from "@/integrations/supabase/client";
import { claimCheckout } from "@/lib/checkout.functions";
import { plan } from "@/lib/pricing";
export const Route = createFileRoute("/complete-account")({
  head: () => ({ meta: [{ title: `Finish your account — ${plan.name}` }] }),
  component: CompleteAccount,
});
function CompleteAccount() {
  const nav = useNavigate(),
    claim = useServerFn(claimCheckout),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [mode, setMode] = useState<"new" | "existing">("new"),
    [session, setSession] = useState(false),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
      if (data.session?.user.email) setEmail(data.session.user.email);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(!!s);
      if (s?.user.email) setEmail(s.user.email);
    });
    fetch("/api/public/checkout")
      .then((r) => r.json())
      .then((c) => {
        if (c.purchase?.email) setEmail(c.purchase.email);
      })
      .catch(() => {});
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      if (!session) {
        if (mode === "existing") {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/complete-account` },
          });
          if (error) throw error;
          if (!data.session) {
            setMsg(
              "Check your email to verify your account, then return here to finish setup. If you received a finish-account invitation after payment, use that link instead.",
            );
            return;
          }
        }
      } else if (password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }
      await claim();
      await nav({ to: "/setup" });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "We couldn't finish setup. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid min-h-screen place-items-center px-5 py-10">
      <section className="glass w-full max-w-lg rounded-[28px] p-7 sm:p-9">
        <BrandLogo />
        <p className="mt-8 text-xs uppercase tracking-[.15em] text-muted-foreground">
          Your purchase, your account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          One last step. Make it yours.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Use your purchase email and choose a password. We verify your payment before connecting it
          to your salon. Your saved details will be waiting.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field label="Purchase email">
            <input
              type="email"
              autoComplete="email"
              required
              disabled={session || busy}
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label={
              session
                ? "Set a password (if you used an invitation)"
                : mode === "new"
                  ? "Choose a password"
                  : "Password"
            }
          >
            <input
              type="password"
              autoComplete={mode === "new" ? "new-password" : "current-password"}
              minLength={mode === "new" || session ? 12 : 1}
              required={!session}
              disabled={busy}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button disabled={busy} className={`${buttonClass} bg-brand w-full text-white`}>
            {busy ? "Securing your account…" : "Finish my account & continue"}
          </button>
        </form>
        {msg && (
          <p role="status" className="mt-5 text-sm leading-relaxed text-muted-foreground">
            {msg}
          </p>
        )}
        {!session && (
          <button
            type="button"
            className="mt-5 text-sm text-muted-foreground"
            onClick={() => setMode(mode === "new" ? "existing" : "new")}
          >
            {mode === "new" ? "Already have an account? Sign in" : "New account? Choose a password"}
          </button>
        )}
        {session && (
          <button
            type="button"
            className="mt-5 text-sm text-muted-foreground"
            onClick={() => void supabase.auth.signOut()}
          >
            Use a different account
          </button>
        )}
        <Link to="/checkout" className="mt-5 block text-xs text-muted-foreground">
          Return to payment status
        </Link>
      </section>
    </div>
  );
}
