// Server-only voice agent provider access. Raw provider errors are logged, never returned.
import { voices, greeting } from "./voices";
import { classifyHttp, type Outcome } from "./provisioning";

const API = "https://api.elevenlabs.io/v1/convai";

export type SalonRow = {
  name: string; address: string; phone: string; website: string; hours: string;
  languages: string[]; voice: string; deposit_policy: string; cancellation_policy: string;
  walk_ins: boolean; id?: string;
};
export type ServiceRow = { id?: string; name: string; price: number; minutes: number; is_addon: boolean };
export type StaffRow = { name: string; service_ids: string[]; hours: unknown };

function key() { return process.env["ELEVENLABS_API_KEY"] ?? ""; }

function buildPrompt(s: SalonRow, services: ServiceRow[], staff: StaffRow[] = []) {
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
${menu || "- Ask the caller what they need and offer a callback with pricing."}

Technicians: ${staff.length ? staff.map((t) => t.name).join(", ") : "not listed"}

Rules you must always follow:
- Never say a time is available unless check_availability returned it in this call.
- Never say an appointment is booked, moved or cancelled unless the tool returned success.
- Never invent prices, services, technicians, policies or hours. If unsure, offer a callback.
- You only work for this salon. Never discuss other salons' clients or calendars.`;
}

const str = (description: string) => ({ type: "string", description });
const caller = { type: "string", dynamic_variable: "system__caller_id", description: "Caller phone" };
const convo = { type: "string", dynamic_variable: "system__conversation_id", description: "Conversation id" };
const TOOLS: [string, string, Record<string, unknown>, string[]][] = [
  ["get_services", "List this salon's current services, prices and durations.", {}, []],
  ["get_staff", "List this salon's technicians and which services each does.", {}, []],
  ["check_availability", "Find open appointment times. Use before offering times.", { date: str("Day in YYYY-MM-DD (salon time). Omit to search the next 7 days."), service: str("Service name from the menu"), technician: str("Preferred technician, if any") }, []],
  ["book_appointment", "Book a confirmed time the caller agreed to. Use the exact start value from check_availability.", { service: str("Service name"), start: str("Slot start (ISO) from check_availability"), technician: str("Technician name from the slot"), client_name: str("Caller's name"), client_phone: caller, conversation_id: convo, notes: str("Anything the salon should know") }, ["service", "start", "client_name"]],
  ["find_my_appointments", "Look up the caller's upcoming appointments by their phone number.", { client_phone: caller }, []],
  ["reschedule_appointment", "Move one of the caller's appointments to a new open time.", { appointment_id: str("id from find_my_appointments"), service: str("Service name"), start: str("New slot start (ISO)"), technician: str("Technician"), client_phone: caller, conversation_id: convo }, ["appointment_id", "service", "start"]],
  ["cancel_appointment", "Cancel one of the caller's appointments after they confirm.", { appointment_id: str("id from find_my_appointments"), client_phone: caller }, ["appointment_id"]],
  ["add_to_waitlist", "Add the caller to the waitlist when nothing suitable is open.", { client_name: str("Caller's name"), service: str("Service"), technician: str("Preferred technician"), preferred: str("Preferred days/times"), client_phone: caller }, ["client_name"]],
];
function tools(url: string | null) {
  if (!url) return undefined;
  return TOOLS.map(([name, description, properties, required]) => ({
    type: "webhook", name, description,
    api_schema: { url: `${url}&tool=${name}`, method: "POST", request_body_schema: { type: "object", properties, required } },
  }));
}

const BOOKING = `

Booking: always call check_availability before offering times, offer two or three options, then book_appointment with the exact start value once the caller agrees. Today's date comes from the tool results; never guess availability. To change or cancel, use find_my_appointments first. If nothing fits, offer add_to_waitlist. If a tool returns an error, apologise and offer a callback.`;

function body(s: SalonRow, services: ServiceRow[], marker?: string, toolUrl?: string | null, staff: StaffRow[] = []) {
  const voiceId = voices.find((v) => v.id === s.voice)?.engine ?? voices[0].engine;
  return {
    name: `Salon Pro Agent — ${s.name || "Salon"}${marker ? ` [${marker}]` : ""}`,
    conversation_config: {
      agent: { first_message: greeting(s.name), language: "en", prompt: { prompt: buildPrompt(s, services, staff) + (toolUrl ? BOOKING : ""), ...(toolUrl ? { tools: tools(toolUrl) } : {}) } },
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

async function url(s: SalonRow) { if (!s.id) return null; const { toolsUrl } = await import("./booking.server"); return toolsUrl(s.id); }

export function agentConfigured() { return !!key(); }

export async function createAgent(s: SalonRow, services: ServiceRow[], marker: string): Promise<Outcome<{ agentId: string }>> {
  const r = await req(`/agents/create`, { method: "POST", body: JSON.stringify(body(s, services, marker, await url(s))) });
  const kind = classifyHttp(r.status);
  const id = (r.json as { agent_id?: string } | null)?.agent_id;
  if (kind === "ok") return id ? { kind: "ok", value: { agentId: id } } : { kind: "ambiguous", code: "unconfirmed" };
  if (kind === "rejected") return { kind: "rejected", code: "provider_rejected" };
  return { kind: "ambiguous", code: "unconfirmed" };
}

/** PATCH is idempotent, so updating an existing agent needs no job. */
export async function updateAgent(agentId: string, s: SalonRow, services: ServiceRow[], staff: StaffRow[] = []): Promise<boolean> {
  const r = await req(`/agents/${encodeURIComponent(agentId)}`, { method: "PATCH", body: JSON.stringify(body(s, services, undefined, await url(s), staff)) });
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
