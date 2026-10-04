import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { CalendarCheck2, Download, Loader2, RefreshCw, TriangleAlert, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  disconnectSquare,
  getSquareStatus,
  previewSquareServices,
  importSquareServices,
  startSquareConnect,
  selectSquareLocation,
} from "@/lib/square-oauth.functions";

/** Connect / reconnect / disconnect the salon's own Square account as its booking source. */
export function SquareConnect({
  salonId,
  canEdit,
  onChanged,
  returnTo = "/dashboard/agent",
  showImport = true,
  beforeAction,
}: {
  salonId: string;
  canEdit: boolean;
  onChanged: () => void;
  returnTo?: "/setup" | "/dashboard/agent";
  showImport?: boolean;
  beforeAction?: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const changeLocation = useServerFn(selectSquareLocation);
  const start = useServerFn(startSquareConnect);
  const disconnect = useServerFn(disconnectSquare);
  const preview = useServerFn(previewSquareServices);
  const [proposal, setProposal] = useState<
    { name: string; price: number; minutes: number; variationId: string }[] | null
  >(null);
  const [selected, setSelected] = useState<string[]>([]);
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
      setNote(
        "Connected to Square. Review your services and verify a test appointment before forwarding client calls.",
      );
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
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      await beforeAction?.();
      const { authorizationUrl } = await start({ data: { salonId, returnTo } });
      window.location.href = authorizationUrl; // full redirect: Square returns to our callback
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setErr(null);
    setNote(null);
    setConfirming(false);
    setBusy(true);
    try {
      await disconnect({ data: { salonId } });
      setNote("Disconnected. Review your scheduling setup before accepting new bookings.");
      await qc.invalidateQueries({ queryKey: ["square-status", salonId] });
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const onImport = async () => {
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      await beforeAction?.();
      const { added, skipped } = await importServices({
        data: { salonId, variationIds: selected },
      });
      setProposal(null);
      onChanged();
      setNote(
        added
          ? `Imported ${added} service${added === 1 ? "" : "s"} from Square${skipped ? ` (${skipped} already here)` : ""}.`
          : "No new rows added. Matching or previously imported services were kept unchanged.",
      );
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const s = status.data;
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent">
          <CalendarCheck2 className="size-5 text-violet" />
        </span>
        <div className="min-w-56 flex-1">
          <h3 className="font-medium">Square Appointments</h3>
          {status.isLoading ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking connection…
            </p>
          ) : s?.connected ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Connected
                {s.businessName && s.businessName !== "Square" ? ` — ${s.businessName}` : ""}.
                Review your Square booking configuration and test an appointment to confirm
                availability, staff and service mapping.
              </p>
              {"locations" in s && s.locations && (
                <label className="mt-3 block text-sm">
                  Book appointments at
                  <select
                    aria-label="Square booking location"
                    disabled={busy || !canEdit}
                    className="mt-2 block w-full rounded-xl border border-border bg-background p-3"
                    value={s.locationId}
                    onChange={async (e) => {
                      setBusy(true);
                      setErr(null);
                      try {
                        await changeLocation({ data: { salonId, locationId: e.target.value } });
                        await qc.invalidateQueries({ queryKey: ["square-status", salonId] });
                        setNote(
                          "Booking location updated. Verify a test appointment at this location.",
                        );
                        onChanged();
                      } catch (e) {
                        setErr((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {s.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {"bookingCapable" in s && !s.bookingCapable && (
                <p className="mt-2 text-sm text-coral">
                  Square does not report seller booking access. Check your Square Appointments plan
                  and permissions before launch.
                </p>
              )}
              {s.reconnectRequired && (
                <p className="mt-2 flex items-center gap-2 text-sm text-coral">
                  <TriangleAlert className="size-4" />
                  Square access expired — reconnect to keep bookings flowing.
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your salon's Square account and your Salon Agent books appointments straight
              into Square Appointments, using your real availability. You can also import your
              Square service menu.
            </p>
          )}
          {note && <p className="mt-2 text-sm text-success">{note}</p>}
          {status.isError && (
            <p role="alert" className="mt-2 text-sm text-coral">
              Could not check Square. Refresh or try connecting again.
            </p>
          )}
          {err && <p className="mt-2 text-sm text-coral">{err}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy && <Loader2 className="size-4 animate-spin text-violet" />}
          {canEdit ? (
            s?.connected ? (
              <>
                <button
                  onClick={async () => {
                    setBusy(true);
                    setErr(null);
                    try {
                      const r = await preview({ data: { salonId } });
                      setProposal(r.services);
                      setSelected(r.services.map((s) => s.variationId));
                    } catch (e) {
                      setErr((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  hidden={!showImport}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium disabled:opacity-50"
                >
                  <Download className="size-4" />
                  Review services
                </button>
                <button
                  onClick={onConnect}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium disabled:opacity-50"
                >
                  <RefreshCw className="size-4" />
                  Reconnect
                </button>
                {confirming ? (
                  <span className="flex items-center gap-2 text-sm">
                    Disconnect Square?
                    <button
                      onClick={onDisconnect}
                      disabled={busy}
                      className="h-9 rounded-full bg-coral/10 px-3 text-sm font-medium text-coral"
                    >
                      Yes, disconnect
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="h-9 rounded-full px-3 text-sm text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    disabled={busy}
                    className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground hover:text-coral"
                  >
                    <Unlink className="size-4" />
                    Disconnect
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onConnect}
                disabled={busy}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground",
                  busy && "opacity-50",
                )}
              >
                <CalendarCheck2 className="size-4" />
                Connect Square
              </button>
            )
          ) : (
            <span className="text-sm text-muted-foreground">
              Only owners and managers can change this.
            </span>
          )}
        </div>
      </div>
      {proposal && (
        <div className="mt-5 border-t border-border pt-5">
          <h4 className="font-medium">Choose services to import</h4>
          <p className="mt-2 text-sm text-muted-foreground">
            Only bookable appointment services with USD prices and durations are listed. Existing
            services stay unchanged; this is a one-time import, not ongoing synchronization.
          </p>
          {proposal.length === 0 && (
            <p className="mt-3 text-sm">
              No eligible services found. Add your menu manually or upload a PDF.
            </p>
          )}
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
            {proposal.map((s) => (
              <label key={s.variationId} className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(s.variationId)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, s.variationId]
                        : selected.filter((id) => id !== s.variationId),
                    )
                  }
                />
                <span>
                  {s.name} · $ {s.price} · {s.minutes} min
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              disabled={busy || !selected.length}
              onClick={onImport}
              className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Approve import
            </button>
            <button disabled={busy} onClick={() => setProposal(null)} className="text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
