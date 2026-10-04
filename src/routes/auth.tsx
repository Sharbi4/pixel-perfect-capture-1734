import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/Brand";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Salon Pro Agent" },
      { name: "description", content: "Sign in or create your Salon Pro Agent account to set up your salon's AI receptionist." },
      { property: "og:title", content: "Sign in — Salon Pro Agent" },
      { property: "og:description", content: "Create your account and set up your salon's AI receptionist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s.next === "string" ? s.next : undefined }),
  component: AuthPage,
});

// Only same-origin relative paths (e.g. the MCP consent screen) are allowed as return targets.
function safeNext(n?: string) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
}

const field = "h-12 w-full rounded-2xl border border-border bg-background/60 px-4 text-sm outline-none focus:border-ring";

function AuthPage() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const dest = safeNext(next);
  const go = () => (dest ? (window.location.href = dest) : nav({ to: "/setup" }));
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) go(); });
    return () => data.subscription.unsubscribe();
  }, [nav, dest]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${dest ?? "/setup"}` } });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Check your email to confirm your account, then come back to sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth${dest ? `?next=${encodeURIComponent(dest)}` : ""}` });
    if (r.error) setMsg(r.error.message);
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="glass w-full max-w-md rounded-[28px] p-8">
        <BrandLogo className="w-[220px] max-w-full sm:w-[240px]" />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{mode === "up" ? "Set up your front desk" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your progress saves as you go, so you can finish anytime.</p>
        <button onClick={google} className="glass mt-8 h-12 w-full rounded-full text-sm font-medium hover:bg-accent">Continue with Google</button>
        <div className="my-6 text-center text-xs text-muted-foreground">or</div>
        <form onSubmit={submit} className="space-y-3">
          <input className={field} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={field} type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} className="h-12 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "One moment…" : mode === "up" ? "Create account" : "Sign in"}
          </button>
        </form>
        {msg && <p className="mt-4 text-sm text-muted-foreground">{msg}</p>}
        <button onClick={() => setMode(mode === "up" ? "in" : "up")} className="mt-6 text-sm text-muted-foreground hover:text-foreground">
          {mode === "up" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
