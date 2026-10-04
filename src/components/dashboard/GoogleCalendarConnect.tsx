import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, Loader2, RefreshCw, TriangleAlert, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  completeGoogleCalendarConnection,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
} from "@/lib/gcal.functions";

/** Connect / reconnect / disconnect the salon's own Google Calendar as its booking source. */
export function GoogleCalendarConnect({ salonId, canEdit, onChanged }: { salonId: string; canEdit: boolean; onChanged: () => void }) {
  const qc = useQueryClient();
  const start = useServerFn(startGoogleCalendarConnect);
  const complete = useServerFn(completeGoogleCalendarConnection);
  const disconnect = useServerFn(disconnectGoogleCalendar);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const status = useQuery({
    queryKey: ["gcal-status", salonId],
    queryFn: () => getGoogleCalendarStatus({ data: { salonId } }),
    staleTime: 60_000,
  });

  function waitForOAuthCompletion(popup: Window) {
    return new Promise<string | null>((resolve, reject) => {
      let poll: number | undefined;
      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        if (poll !== undefined) window.clearInterval(poll);
      };
      const onMessage = (event: MessageEvent) => {
        const type = event.data?.type;
        if (
          event.origin !== window.location.origin ||
          event.source !== popup ||
          event.data?.connectorId !== "google_calendar" ||
          (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
        ) return;
        cleanup();
        if (type === "appUserConnectorOAuthComplete") {
          resolve(typeof event.data?.code === "string" ? event.data.code : null);
          return;
        }
        popup.close();
        reject(new Error("Google didn't finish the connection. Please try again."));
      };
      window.addEventListener("message", onMessage);
      poll = window.setInterval(() => {
        if (!popup.closed) return;
        cleanup();
        reject(new Error("The Google window was closed before finishing. Please try again."));
      }, 500);
    });
  }

  const onConnect = async () => {
    setErr(null); setNote(null); setBusy(true);
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) { setErr("Allow pop-ups to connect Google Calendar."); setBusy(false); return; }
    let code: string | null;
    try {
      const { authorizationUrl } = await start({ data: { salonId } });
      const completion = waitForOAuthCompletion(popup);
      popup.location.href = authorizationUrl;
      code = await completion;
    } catch (e) {
      popup.close();
      setErr((e as Error).message);
      setBusy(false);
      return;
    }
    // Exchange here, never in the popup: in the embedded preview the popup has no app session.
    try {
      if (code) await complete({ data: { salonId, code } });
      setNote("Connected to Google Calendar.");
      await qc.invalidateQueries({ queryKey: ["gcal-status", salonId] });
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const onDisconnect = async () => {
    setErr(null); setNote(null); setConfirming(false); setBusy(true);
    try {
      await disconnect({ data: { salonId } });
      setNote("Disconnected. Bookings now use Salon Pro Scheduling.");
      await qc.invalidateQueries({ queryKey: ["gcal-status", salonId] });
      onChanged();
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
          <h3 className="font-medium">Google Calendar</h3>
          {status.isLoading ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Checking connection…</p>
          ) : s?.connected ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Connected{s.calendarSummary && s.calendarSummary !== "Google Calendar" ? ` — ${s.calendarSummary}` : ""}. Every appointment your Salon Agent books goes straight into this calendar, and it avoids events already on it.
              </p>
              {s.reconnectRequired && (
                <p className="mt-2 flex items-center gap-2 text-sm text-coral"><TriangleAlert className="size-4" />Google access expired — reconnect to keep bookings flowing.</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your salon's Google Calendar and your Salon Agent books appointments straight into it, using your business hours minus what's already booked.
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
                <button onClick={onConnect} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium disabled:opacity-50"><RefreshCw className="size-4" />{s.reconnectRequired ? "Reconnect" : "Reconnect Google"}</button>
                {confirming ? (
                  <span className="flex items-center gap-2 text-sm">
                    Disconnect Google Calendar?
                    <button onClick={onDisconnect} disabled={busy} className="h-9 rounded-full bg-coral/10 px-3 text-sm font-medium text-coral">Yes, disconnect</button>
                    <button onClick={() => setConfirming(false)} className="h-9 rounded-full px-3 text-sm text-muted-foreground">Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirming(true)} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground hover:text-coral"><Unlink className="size-4" />Disconnect</button>
                )}
              </>
            ) : (
              <button onClick={onConnect} disabled={busy} className={cn("inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground", busy && "opacity-50")}><CalendarCheck2 className="size-4" />Connect Google Calendar</button>
            )
          ) : (
            <span className="text-sm text-muted-foreground">Only owners and managers can change this.</span>
          )}
        </div>
      </div>
    </section>
  );
}
