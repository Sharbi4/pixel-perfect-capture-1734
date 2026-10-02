// Server-only voice agent provider access. Raw provider errors are logged, never returned.
import { voices, greeting } from "./voices";
import { classifyHttp, type Outcome } from "./provisioning";

const API = "https://api.elevenlabs.io/v1/convai";

export type SalonRow = {
  name: string; address: string; phone: string; website: string; hours: string;
  languages: string[]; voice: string; deposit_policy: string; cancellation_policy: string;
  walk_ins: boolean;
};
export type ServiceRow = { name: string; price: number; minutes: number; is_addon: boolean };

function key() { return process.env["ELEVENLABS_API_KEY"] ?? ""; }

function buildPrompt(s: SalonRow, services: ServiceRow[]) {
  const menu = services
    .map((x) => `- ${x.name}${x.is_addon ? " (add-on)" : ""}: $${x.price}, about ${x.minutes} min`)
    .join("\n");
  return `You are the friendly front-desk receptionist for ${s.name || "the salon"}, a nail salon. You answer phone calls.
Keep replies short and natural, like a real receptionist. Ask one question at a time.
Help callers with prices, services, hours and booking appointments. To book, collect: service, preferred day and time, name and phone number, then repeat the details back to confirm.
Never invent prices or services that are not listed. If unsure, offer to have the salon call them back.

Salon details:
Address: ${s.address || "not provided"}
Phone: ${s.phone || "not provided"}
Website: ${s.website || "not provided"}
Hours: ${s.hours || "not provided"}
Walk-ins: ${s.walk_ins ? "welcome" : "appointment only"}
Deposit policy: ${s.deposit_policy || "none"}
Cancellation policy: ${s.cancellation_policy || "none"}
Languages: ${s.languages.join(", ")}

Service menu:
${menu || "- Ask the caller what they need and offer a callback with pricing."}`;
}

function body(s: SalonRow, services: ServiceRow[], marker?: string) {
  const voiceId = voices.find((v) => v.id === s.voice)?.engine ?? voices[0].engine;
  return {
    name: `Salon Agent — ${s.name || "Salon"}${marker ? ` [${marker}]` : ""}`,
    conversation_config: {
      agent: { first_message: greeting(s.name), language: "en", prompt: { prompt: buildPrompt(s, services) } },
      tts: { voice_id: voiceId },
    },
  };
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init, headers: { "xi-api-key": key(), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) console.error(`Voice provider ${init?.method ?? "GET"} ${path.split("?")[0]} [${res.status}]: ${text.slice(0, 500)}`);
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

export function agentConfigured() { return !!key(); }

export async function createAgent(s: SalonRow, services: ServiceRow[], marker: string): Promise<Outcome<{ agentId: string }>> {
  const r = await req(`/agents/create`, { method: "POST", body: JSON.stringify(body(s, services, marker)) });
  const kind = classifyHttp(r.status);
  const id = (r.json as { agent_id?: string } | null)?.agent_id;
  if (kind === "ok") return id ? { kind: "ok", value: { agentId: id } } : { kind: "ambiguous", code: "unconfirmed" };
  if (kind === "rejected") return { kind: "rejected", code: "provider_rejected" };
  return { kind: "ambiguous", code: "unconfirmed" };
}

/** PATCH is idempotent, so updating an existing agent needs no job. */
export async function updateAgent(agentId: string, s: SalonRow, services: ServiceRow[]): Promise<boolean> {
  const r = await req(`/agents/${encodeURIComponent(agentId)}`, { method: "PATCH", body: JSON.stringify(body(s, services)) });
  return r.status >= 200 && r.status < 300;
}

/** Read-only reconciliation: find an agent we created, by the job marker embedded in its name. */
export async function findAgentByMarker(marker: string): Promise<Outcome<string | null>> {
  const r = await req(`/agents?${new URLSearchParams({ search: marker, page_size: "10" })}`);
  if (r.status !== 200) return { kind: "ambiguous", code: "check_failed" };
  const list = (r.json as { agents?: { agent_id: string; name: string }[] })?.agents;
  if (!Array.isArray(list)) return { kind: "ambiguous", code: "check_failed" };
  return { kind: "ok", value: list.find((a) => a.name.includes(`[${marker}]`))?.agent_id ?? null };
}

export async function agentToken(agentId: string) {
  const r = await req(`/conversation/token?agent_id=${encodeURIComponent(agentId)}`);
  const token = (r.json as { token?: string } | null)?.token;
  if (r.status !== 200 || !token) throw new Error("Couldn't start the test call. Please try again.");
  return token;
}
