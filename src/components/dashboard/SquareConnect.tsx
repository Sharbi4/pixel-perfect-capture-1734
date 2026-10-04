import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw, Store, TriangleAlert, Unlink, Users } from "lucide-react";
import { disconnectSquare, getSquareStatus, importSquareTeam, setSquareBooking, setSquareLocation, startSquareConnect } from "@/lib/square-oauth.functions";

/** Connect the salon's own Square account: services, team and appointments. */
export function SquareConnect({ salonId, canEdit, onChanged }: { salonId: string; canEdit: boolean; onChanged: () => void }) {
  const qc = useQueryClient();
  const start = useServerFn(startSquareConnect);
  const disconnect = useServerFn(disconnectSquare);
  const setLoc = useServerFn(setSquareLocation);
  const setBooking = useServerFn(setSquareBooking);
  const importTeam = useServerFn(importSquareTeam);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const status = useQuery({ queryKey: ["square-status", salonId], queryFn: () => getSquareStatus({ data: { salonId } }), staleTime: 60_000 });
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["square-status", salonId] }); onChanged(); };
  const run = async (fn: () => Promise<string | void>) => {
    setErr(null); setNote(null); setBusy(true);
    try { const m = await fn(); if (m) setNote(m); await refresh(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const onConnect = async () => {
    setErr(null); setNote(null); setBusy(true);
    const popup = window.open("", "square-oauth", "width=600,height=760");
    if (!popup) { setErr("Allow pop-ups to connect Square."); setBusy(false); return; }
    try {
      const { authorizationUrl } = await start({ data: { salonId } });
      popup.location.href = authorizationUrl;
    } catch (e) { popup.close(); setErr((e as Error).message); setBusy(false); return; }
    // The approval finishes on our server; when the window closes, re-check the saved connection.
    const timer = window.setInterval(async () => {
      if (!popup.closed) return;
      window.clearInterval(timer);
      await refresh();
      const s = qc.getQueryData<any>(["square-status", salonId]);
      if (s?.connected) setNote("Connected to Square."); else setErr("Square wasn't connected. Please try again.");
      setBusy(false);
    }, 700);
  };

  const s = status.data;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent"><Store className="size-5" /></span>
          <div>
            <h3 className="font-semibold">Square</h3>
            <p className="text-sm text-muted-foreground">
              {status.isLoading ? "Checking…" : !s?.connected ? "Bring in your Square services, team and appointments." : s.reconnectRequired ? "Your Square access needs to be renewed." : `Connected to ${s.merchantName}${s.locationName ? ` · ${s.locationName}` : ""}`}
            </p>
          </div>
        </div>
        {canEdit && (!s?.connected || s.reconnectRequired) && (
          <button onClick={onConnect} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{s?.connected ? "Reconnect Square" : "Connect Square"}
          </button>
        )}
      </div>

      {s?.connected && !s.reconnectRequired && (
        <div className="mt-4 space-y-3 text-sm">
          {s.locations.length > 1 && (
            <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Square location for this salon</span>
              <select disabled={!canEdit || busy} value={s.locationId} onChange={(e) => { const l = s.locations.find((x) => x.id === e.target.value); if (l) run(async () => { await setLoc({ data: { salonId, locationId: l.id, locationName: l.name } }); return "Location saved."; }); }} className="h-10 w-full rounded-xl border border-border bg-background px-3">
                <option value="" disabled>Choose a location</option>
                {s.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Link to="/dashboard/services" className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4">Import services from Square</Link>
              <button disabled={busy} onClick={() => run(async () => { const r = await importTeam({ data: { salonId } }); return `Team: ${r.added} added, ${r.linked} matched (of ${r.total} bookable in Square).`; })} className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 disabled:opacity-60"><Users className="size-4" />Import team</button>
              <button disabled={busy} onClick={() => run(async () => { await setBooking({ data: { salonId, on: !s.bookingViaSquare } }); return s.bookingViaSquare ? "The agent now books with Salon Pro Scheduling." : "The agent now books straight into Square."; })} className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 disabled:opacity-60">
                {s.bookingViaSquare ? "Stop booking in Square" : "Book appointments in Square"}
              </button>
              <button disabled={busy} onClick={() => { if (confirm("Disconnect Square from this location?")) run(async () => { await disconnect({ data: { salonId } }); return "Square disconnected."; }); }} className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-muted-foreground hover:bg-accent disabled:opacity-60"><Unlink className="size-4" />Disconnect</button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{s.bookingViaSquare ? "Your agent checks Square availability and books, moves and cancels Square appointments." : "Bookings currently stay in Salon Pro Scheduling."}</p>
        </div>
      )}
      {!canEdit && !s?.connected && <p className="mt-3 text-xs text-muted-foreground">An owner or manager can connect Square.</p>}
      {note && <p className="mt-3 text-sm text-primary">{note}</p>}
      {err && <p className="mt-3 flex items-center gap-2 text-sm text-destructive"><TriangleAlert className="size-4" />{err}</p>}
    </section>
  );
}
