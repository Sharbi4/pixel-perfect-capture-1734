// Server-only phone provider access through the connector gateway. Raw provider errors never leave this file.
import { classifyHttp, type Candidate, type Outcome } from "./provisioning";

const GATEWAY = "https://connector-gateway.lovable.dev/twilio";

function keys() {
  const lov = process.env["LOVABLE_API_KEY"];
  const tw = process.env["TWILIO_API_KEY"];
  return lov && tw ? { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": tw } : null;
}

/** Canonical public origin for provider callbacks — never derived from the request host. */
function publicOrigin(): string | null {
  const raw = process.env["PUBLIC_APP_ORIGIN"];
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.origin : null;
  } catch { return null; }
}

export function callbackUrl(salonId: string): string | null {
  const origin = publicOrigin();
  const k = process.env["TWILIO_WEBHOOK_SECRET"];
  if (!origin || !k) return null;
  return `${origin}/api/public/incoming-call?salon=${salonId}&k=${encodeURIComponent(k)}`;
}

export function phoneConfigured(): boolean {
  return !!keys() && !!process.env["TWILIO_WEBHOOK_SECRET"] && !!publicOrigin();
}

export async function tw(path: string, init?: RequestInit): Promise<{ status: number; json: unknown }> {
  const h = keys();
  if (!h) return { status: 401, json: null };
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { ...h, ...(init?.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) console.error(`Phone provider ${init?.method ?? "GET"} ${path.split("?")[0]} [${res.status}]: ${text.slice(0, 500)}`);
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

type Avail = { available_phone_numbers?: { phone_number: string; locality: string; region: string }[] };

async function search(params: Record<string, string>): Promise<Candidate[]> {
  const q = new URLSearchParams({ VoiceEnabled: "true", SmsEnabled: "true", PageSize: "10", ...params });
  const r = await tw(`/AvailablePhoneNumbers/US/Local.json?${q}`);
  if (r.status !== 200) throw new Error("search_failed");
  return ((r.json as Avail)?.available_phone_numbers ?? []).map((n) => ({
    number: n.phone_number, region: n.region ?? "", locality: n.locality ?? "",
  }));
}

export const searchByArea = (area: string) => search({ AreaCode: area });
// Provider-documented proximity search (US/Canada): numbers geographically near the given number.
export const searchNearby = (e164: string) => search({ NearNumber: e164, Distance: "25" });

export async function buyNumber(e164: string, voiceUrl: string, label: string): Promise<Outcome<{ sid: string }>> {
  const r = await tw(`/IncomingPhoneNumbers.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ PhoneNumber: e164, VoiceUrl: voiceUrl, VoiceMethod: "POST", FriendlyName: label }),
  });
  const kind = classifyHttp(r.status);
  const j = r.json as { sid?: string; phone_number?: string; code?: number } | null;
  if (kind === "ok") {
    return j?.sid && j.phone_number === e164 ? { kind: "ok", value: { sid: j.sid } } : { kind: "ambiguous", code: "unconfirmed" };
  }
  if (kind === "rejected") return { kind: "rejected", code: j?.code === 21422 ? "number_unavailable" : "provider_rejected" };
  return { kind: "ambiguous", code: "unconfirmed" };
}

/** Read-only: does our account own this number? */
export async function findOwnedNumber(e164: string): Promise<Outcome<string | null>> {
  const r = await tw(`/IncomingPhoneNumbers.json?${new URLSearchParams({ PhoneNumber: e164 })}`);
  if (r.status !== 200) return { kind: "ambiguous", code: "check_failed" };
  const list = (r.json as { incoming_phone_numbers?: { sid: string; phone_number: string }[] })?.incoming_phone_numbers;
  if (!Array.isArray(list)) return { kind: "ambiguous", code: "check_failed" };
  return { kind: "ok", value: list.find((n) => n.phone_number === e164)?.sid ?? null };
}
