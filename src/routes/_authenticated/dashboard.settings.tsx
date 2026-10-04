import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveLocation } from "@/components/dashboard/location-context";
import { SMS_TEMPLATES, renderSms, type SmsKind, type SmsTemplate } from "@/lib/sms-templates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({ meta: [{ title: "Text settings — Salon Pro Agent" }, { name: "description", content: "Choose which automatic texts your Salon Agent sends and edit their wording." }, { property: "og:title", content: "Text settings — Salon Pro Agent" }, { property: "og:description", content: "Automatic text controls and templates." }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

type Row = { kind: SmsKind; enabled: boolean; body: string; marketing_ack_at: string | null };
const SAMPLE = { salon: "", service: "Gel manicure", tech: "Mia", when: "Fri, Oct 9 at 2:00 PM", address: "123 Main St.", link: "salonagentai.com/b/xyz", offer: "20% off pedicures this week!" };

function SettingsPage() {
  const { location } = useActiveLocation();
  const [rows, setRows] = useState<Record<string, Row> | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data }, { data: u }] = await Promise.all([
      supabase.from("sms_automations").select("kind,enabled,body,marketing_ack_at").eq("salon_id", location.id),
      supabase.auth.getUser(),
    ]);
    const { data: m } = await supabase.from("salon_members").select("role").eq("salon_id", location.id).eq("user_id", u.user?.id ?? "").maybeSingle();
    setCanEdit(m?.role === "owner" || m?.role === "manager");
    const map: Record<string, Row> = {};
    for (const t of SMS_TEMPLATES) map[t.kind] = { kind: t.kind, enabled: t.defaultOn, body: "", marketing_ack_at: null };
    for (const r of (data ?? []) as Row[]) map[r.kind] = r;
    setRows(map);
  }, [location.id]);
  useEffect(() => { void load(); }, [load]);

  const save = async (k: SmsKind, p: Partial<Row>) => {
    setErr(null);
    const next = { ...rows![k]!, ...p };
    setRows((r) => r && { ...r, [k]: next });
    const { error } = await supabase.from("sms_automations").upsert({ salon_id: location.id, kind: k, enabled: next.enabled, body: next.body, marketing_ack_at: next.marketing_ack_at });
    if (error) { setErr(error.message.includes("marketing_consent") ? "Confirm the consent rules before turning on marketing texts." : "Couldn't save that change."); void load(); }
  };

  if (!rows) return <div className="grid place-items-center py-24"><Loader2 className="size-5 animate-spin" /></div>;
  const tx = SMS_TEMPLATES.filter((t) => !t.marketing);
  const mk = SMS_TEMPLATES.find((t) => t.marketing)!;
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-muted-foreground">{location.name || "Your salon"}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Text settings</h1>
      <p className="mt-2 text-muted-foreground">Choose which texts your Salon Agent sends on its own, and how they read. Clients who reply STOP never get automatic texts.</p>
      {!canEdit && <p className="mt-4 text-sm text-muted-foreground">Only owners and managers can change these.</p>}
      {err && <p className="mt-4 text-sm text-coral">{err}</p>}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Appointment & service texts</h2>
      <div className="mt-3 space-y-3">{tx.map((t) => <Card key={t.kind} t={t} row={rows[t.kind]!} salon={location.name} disabled={!canEdit} onSave={(p) => save(t.kind, p)} />)}</div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Marketing</h2>
      <p className="mt-1 text-sm text-muted-foreground">Kept separate from appointment texts. Only sent to clients you've marked as agreeing to marketing texts in Messages.</p>
      <div className="mt-3"><Card t={mk} row={rows[mk.kind]!} salon={location.name} disabled={!canEdit} onSave={(p) => save(mk.kind, p)} /></div>
    </div>
  );
}

function Card({ t, row, salon, disabled, onSave }: { t: SmsTemplate; row: Row; salon: string; disabled: boolean; onSave: (p: Partial<Row>) => void }) {
  const [body, setBody] = useState(row.body || t.body);
  const [ack, setAck] = useState(false);
  const needsAck = t.marketing && !row.marketing_ack_at;
  const preview = renderSms(t.kind, body, { ...SAMPLE, salon: salon || "Your salon" });
  const toggle = () => {
    if (!row.enabled && needsAck) { if (!ack) return; onSave({ enabled: true, marketing_ack_at: new Date().toISOString() }); return; }
    onSave({ enabled: !row.enabled });
  };
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{t.label}</h3>
            {!t.live && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">Not sending yet</span>}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.help}</p>
        </div>
        <button role="switch" aria-checked={row.enabled} aria-label={t.label} disabled={disabled || (!row.enabled && needsAck && !ack)} onClick={toggle}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", row.enabled ? "bg-primary" : "bg-accent")}>
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-background transition", row.enabled ? "left-[22px]" : "left-0.5")} />
        </button>
      </div>
      {needsAck && !row.enabled && (
        <label className="mt-3 flex items-start gap-2 rounded-2xl bg-accent p-3 text-xs">
          <input type="checkbox" checked={ack} disabled={disabled} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
          I confirm we'll only send marketing texts to clients who gave written permission to receive them, and that every message lets them opt out.
        </label>
      )}
      <textarea value={body} disabled={disabled} maxLength={400} onChange={(e) => setBody(e.target.value)} onBlur={() => body !== (row.body || t.body) && onSave({ body: body === t.body ? "" : body })}
        rows={2} className="mt-4 w-full resize-none rounded-2xl bg-accent px-3 py-2 text-sm outline-none" aria-label={`${t.label} wording`} />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Fill-ins: {"{salon} {service} {tech} {when} {address} {link}"}{t.marketing ? " {offer}" : ""}</span>
        {body !== t.body && !disabled && <button onClick={() => { setBody(t.body); onSave({ body: "" }); }} className="text-violet hover:underline">Reset wording</button>}
      </div>
      {t.required && <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3" />Always added: "{t.required}"</p>}
      <p className="mt-3 rounded-2xl border border-border px-3 py-2 text-sm"><span className="text-xs text-muted-foreground">Preview · </span>{preview}</p>
    </div>
  );
}
