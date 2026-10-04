import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand/Brand";

type Details = { client?: { name?: string }; redirect_url?: string; redirect_to?: string };
type OAuthApi = {
  getAuthorizationDetails(id: string): Promise<{ data: Details | null; error: { message: string } | null }>;
  approveAuthorization(id: string): Promise<{ data: Details | null; error: { message: string } | null }>;
  denyAuthorization(id: string): Promise<{ data: Details | null; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [{ title: "Connect an app — Salon Pro Agent" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "" }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization request.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-screen place-items-center p-6 text-center"><p role="alert">This connection request couldn't be loaded. It may have expired — please try connecting again. <span className="block mt-2 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</span></p></main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "An app";

  async function decide(approve: boolean) {
    setBusy(true); setError(null);
    const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
    const target = data?.redirect_url ?? data?.redirect_to;
    if (error || !target) { setBusy(false); setError(error?.message ?? "Something went wrong. Please try again."); return; }
    window.location.href = target;
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="glass w-full max-w-md rounded-[28px] p-8">
        <BrandLogo className="w-[200px]" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Connect {name} to your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">{name} will be able to read your salon locations, calls and text conversations as you. You can disconnect it anytime.</p>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-8 flex gap-3">
          <button disabled={busy} onClick={() => decide(true)} className="h-11 flex-1 rounded-full bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">Approve</button>
          <button disabled={busy} onClick={() => decide(false)} className="h-11 flex-1 rounded-full bg-accent text-sm disabled:opacity-60">Deny</button>
        </div>
      </div>
    </main>
  );
}
