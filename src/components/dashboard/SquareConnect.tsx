import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { CalendarCheck2, Download, Loader2, RefreshCw, TriangleAlert, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import { disconnectSquare, getSquareStatus, importSquareServices, startSquareConnect } from "@/lib/square-oauth.functions";

/** Connect / reconnect / disconnect the salon's own Square account as its booking source. */
export function SquareConnect({ salonId, canEdit, onChanged }: { salonId: string; canEdit: boolean; onChanged: () => void }) {
  const qc = useQueryClient();
  const start = useServerFn(startSquareConnect);
  const disconnect = useServerFn(disconnectSquare);
  const importServices = useServerFn(importSquareServices);
  const search = useSearch({ strict: false }) as { square?: string };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const status = useQuery({
    queryKey: ["square-status", salonId],
    queryFn: () => getSquareStatus({ data: { salonId } }),
    staleTime: 60_000,
  });

  // Square redirects the whole window back here with ?square=connected|error|denied|…
  useEffect(() => {
    if (!search.square) return;
    if (search.square === "connected") {
      setNote("Connected to Square. Appointments your Salon Agent books now go straight into Square Appointments.");
      qc.invalidateQueries({ queryKey: ["square-status", salonId] });
      onChanged();
    } else if (search.square === "denied") {
      setErr("Square access was declined — nothing was connected.");
    } else {
      setErr("Square didn't finish the connection. Please try again.");
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [search.square, salonId, qc, onChanged]);

  const onConnect = async () => {
    setErr(null); setNote(null); setBusy(true);
    try {
      const { authorizationUrl } = await start({ data: { salonId } });
      window.location.href = authorizationUrl; // full redirect: Square returns to our callback
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setErr(null); setNote(null); setConfirming(false); setBusy(true);
    try {
      await disconnect({ data: { salonId } });
      setNote("Disconnected. Bookings now use Salon Pro Scheduling.");
      await qc.invalidateQueries({ queryKey: ["square-status", salonId] });
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const onImport = async () => {
    setErr(null); setNote(null); setBusy(true);
    try {
      const { added, skipped } = await importServices({ data: { salonId } });
      setNote(added ? `Imported ${added} service${added === 1 ? "" : "s"} from Square${skipped ? ` (${skipped} already here)` : ""}.` : "No new services to import — your menu already matches Square.");
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const s = status.data;
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent"><CalendarCheck2 className="size-5 text-violet" /></span>
        <div className="min-w-56 flex-1">
          <h3 className="font-medium">Square Appointments</h3>
          {status.isLoading ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Checking connection…</p>
          ) : s?.connected ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Connected{s.businessName && s.businessName !== "Square" ? ` — ${s.businessName}` : ""}. Every appointment your Salon Agent books goes straight into your Square calendar, and it avoids times already booked.
              </p>
              {s.reconnectRequired && (
                <p className="mt-2 flex items-center gap-2 text-sm text-coral"><TriangleAlert className="size-4" />Square access expired — reconnect to keep bookings flowing.</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your salon's Square account and your Salon Agent books appointments straight into Square Appointments, using your real availability. You can also import your Square service menu.
            </p>
          )}
          {note && <p className="mt-2 text-sm text-success">{note}</p>}
          {err && <p className="mt-2 text-sm text-coral">{err}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy && <Loader2 className="size-4 animate-spin text-violet" />}
          {canEdit ? (
            s?.connected ? (
              <>
                <button onClick={onImport} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium disabled:opacity-50"><Download className="size-4" />Import services</button>
                <button onClick={onConnect} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium disabled:opacity-50"><RefreshCw className="size-4" />Reconnect</button>
                {confirming ? (
                  <span className="flex items-center gap-2 text-sm">
                    Disconnect Square?
                    <button onClick={onDisconnect} disabled={busy} className="h-9 rounded-full bg-coral/10 px-3 text-sm font-medium text-coral">Yes, disconnect</button>
                    <button onClick={() => setConfirming(false)} className="h-9 rounded-full px-3 text-sm text-muted-foreground">Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirming(true)} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground hover:text-coral"><Unlink className="size-4" />Disconnect</button>
                )}
              </>
            ) : (
              <button onClick={onConnect} disabled={busy} className={cn("inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground", busy && "opacity-50")}><CalendarCheck2 className="size-4" />Connect Square</button>
            )
          ) : (
            <span className="text-sm text-muted-foreground">Only owners and managers can change this.</span>
          )}
        </div>
      </div>
    </section>
  );
}
