const GATEWAY = "https://connector-gateway.lovable.dev/twilio";

function headers() {
  const lov = process.env["LOVABLE_API_KEY"];
  const tw = process.env["TWILIO_API_KEY"];
  if (!lov || !tw) throw new Error("Phone service is not configured.");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": tw };
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Phone provider failed [${res.status}]: ${body}`);
    let msg = "The phone service had a problem. Please try again.";
    try { const j = JSON.parse(body); if (j.message) msg = j.message; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return res.json();
}

export async function searchNumbers(areaCode: string) {
  const q = new URLSearchParams({ VoiceEnabled: "true", SmsEnabled: "true", PageSize: "8" });
  if (areaCode) q.set("AreaCode", areaCode);
  const j = (await call(`/AvailablePhoneNumbers/US/Local.json?${q}`)) as {
    available_phone_numbers: { phone_number: string; friendly_name: string; locality: string; region: string }[];
  };
  return j.available_phone_numbers.map((n) => ({
    number: n.phone_number, display: n.friendly_name, place: [n.locality, n.region].filter(Boolean).join(", "),
  }));
}

export async function buyNumber(number: string, voiceUrl: string, label: string) {
  const j = (await call(`/IncomingPhoneNumbers.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ PhoneNumber: number, VoiceUrl: voiceUrl, VoiceMethod: "POST", FriendlyName: label }),
  })) as { sid: string; phone_number: string };
  return { sid: j.sid, number: j.phone_number };
}

export async function pointNumber(sid: string, voiceUrl: string) {
  await call(`/IncomingPhoneNumbers/${sid}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ VoiceUrl: voiceUrl, VoiceMethod: "POST" }),
  });
}

export function voiceUrl(origin: string, salonId: string) {
  const k = process.env["TWILIO_WEBHOOK_SECRET"];
  if (!k) throw new Error("Phone service is not configured.");
  return `${origin}/api/public/incoming-call?salon=${salonId}&k=${encodeURIComponent(k)}`;
}
