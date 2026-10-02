import { voices, greeting } from "./voices";

type SalonRow = {
  name: string; address: string; phone: string; website: string; hours: string;
  languages: string[]; voice: string; deposit_policy: string; cancellation_policy: string;
  walk_ins: boolean; agent_id: string;
};
type ServiceRow = { name: string; price: number; minutes: number; is_addon: boolean };

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

/** Creates or updates this salon's voice agent. Returns the agent id. */
export async function upsertAgent(s: SalonRow, services: ServiceRow[]) {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("Receptionist service is not configured.");
  const voiceId = voices.find((v) => v.id === s.voice)?.engine ?? voices[0].engine;
  const body = {
    name: `NailDesk — ${s.name || "Salon"}`,
    conversation_config: {
      agent: {
        first_message: greeting(s.name),
        language: "en",
        prompt: { prompt: buildPrompt(s, services) },
      },
      tts: { voice_id: voiceId },
    },
  };
  const url = s.agent_id
    ? `https://api.elevenlabs.io/v1/convai/agents/${s.agent_id}`
    : "https://api.elevenlabs.io/v1/convai/agents/create";
  const res = await fetch(url, {
    method: s.agent_id ? "PATCH" : "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Agent upsert failed [${res.status}]: ${t}`);
    throw new Error("We couldn't build your receptionist just now. Please try again.");
  }
  const j = (await res.json()) as { agent_id?: string };
  return j.agent_id ?? s.agent_id;
}

export async function agentToken(agentId: string) {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("Receptionist service is not configured.");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": key } },
  );
  if (!res.ok) {
    console.error(`Token failed [${res.status}]: ${await res.text()}`);
    throw new Error("Couldn't start the test call.");
  }
  return ((await res.json()) as { token: string }).token;
}
