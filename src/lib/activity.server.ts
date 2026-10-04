// Server-only: pull real call/text history from the voice and phone providers into calls/messages.
import { tw } from "./phone.server";

const EL = "https://api.elevenlabs.io/v1/convai";
type Admin = any;

type ElList = { conversations?: { conversation_id: string }[] };
type ElDetail = {
  status?: string;
  has_audio?: boolean;
  transcript?: { role: string; message: string | null; time_in_call_secs?: number }[];
  metadata?: { start_time_unix_secs?: number; call_duration_secs?: number; phone_call?: { external_number?: string; direction?: string } };
  analysis?: { transcript_summary?: string; call_summary_title?: string; call_successful?: string };
};

export async function syncCalls(sb: Admin, salonId: string, agentId: string): Promise<boolean> {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key || !agentId) return false;
  const h = { "xi-api-key": key };
  const res = await fetch(`${EL}/conversations?${new URLSearchParams({ agent_id: agentId, page_size: "50" })}`, { headers: h });
  if (!res.ok) { console.error(`call history list [${res.status}]`); return false; }
  const ids = ((await res.json()) as ElList).conversations?.map((c) => c.conversation_id) ?? [];
  if (!ids.length) return true;
  const { data: have } = await sb.from("calls").select("provider_ref").in("provider_ref", ids);
  const known = new Set((have ?? []).map((r: { provider_ref: string }) => r.provider_ref));
  const fresh = ids.filter((i) => !known.has(i)).slice(0, 20);
  for (const id of fresh) {
    const r = await fetch(`${EL}/conversations/${id}`, { headers: h });
    if (!r.ok) continue;
    const d = (await r.json()) as ElDetail;
    if (d.status && d.status !== "done" && d.status !== "failed") continue; // still in progress; pick up next sync
    const m = d.metadata ?? {};
    await sb.from("calls").upsert({
      salon_id: salonId, provider_ref: id,
      started_at: new Date((m.start_time_unix_secs ?? Date.now() / 1000) * 1000).toISOString(),
      duration_secs: Math.round(m.call_duration_secs ?? 0),
      direction: m.phone_call?.direction === "outbound" ? "outbound" : "inbound",
      customer_phone: m.phone_call?.external_number ?? "",
      status: d.status ?? "", outcome: d.analysis?.call_successful ?? "", has_recording: d.has_audio !== false,
      summary: d.analysis?.transcript_summary ?? "", title: d.analysis?.call_summary_title ?? "",
      transcript: (d.transcript ?? []).filter((t) => t.message).map((t) => ({ role: t.role === "agent" ? "agent" : "customer", text: t.message, t: Math.round(t.time_in_call_secs ?? 0) })),
    }, { onConflict: "provider_ref", ignoreDuplicates: true });
  }
  return true;
}

type TwMsg = { sid: string; date_sent: string | null; date_created: string; direction: string; from: string; to: string; body: string; status: string };

export async function syncMessages(sb: Admin, salonId: string, number: string): Promise<boolean> {
  if (!number) return false;
  const rows: Record<string, unknown>[] = [];
  for (const side of ["To", "From"] as const) {
    const r = await tw(`/Messages.json?${new URLSearchParams({ [side]: number, PageSize: "100" })}`);
    if (r.status !== 200) return false;
    for (const m of ((r.json as { messages?: TwMsg[] })?.messages ?? [])) {
      const inbound = m.direction === "inbound";
      rows.push({
        salon_id: salonId, provider_ref: m.sid, sent_at: new Date(m.date_sent ?? m.date_created).toISOString(),
        direction: inbound ? "inbound" : "outbound", customer_phone: inbound ? m.from : m.to, body: m.body ?? "", status: m.status ?? "",
      });
    }
  }
  if (rows.length) await sb.from("messages").upsert(rows, { onConflict: "provider_ref" });
  return true;
}
