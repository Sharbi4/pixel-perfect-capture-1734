// Server-only Square OAuth + API client for each salon's own Square account. Owners authorize
// their merchant; the server stores the token bundle encrypted in salon_calendar_connections
// (provider='square') and never exposes it to the browser. Never import from client modules.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { decryptConnectionKey, encryptConnectionKey } from "./connectionKeyCrypto.server";

const BASE = "https://connect.squareup.com";
const VERSION = "2025-10-16";

export const SQUARE_SCOPES = [
  "APPOINTMENTS_READ",
  "APPOINTMENTS_WRITE",
  "ITEMS_READ",
  "MERCHANT_PROFILE_READ",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
];

export type SquareTokens = { accessToken: string; refreshToken: string; expiresAt: string; merchantId: string };
export type SquareConnection = { tokens: SquareTokens; locationId: string; businessName: string; updatedAt: string };

function appId(): string {
  const id = process.env["SQUARE_APPLICATION_ID"];
  if (!id) throw new Error("Square isn't set up on our side yet. Please contact support.");
  return id;
}

function appSecret(): string {
  const s = process.env["SQUARE_OAUTH_SECRET"];
  if (!s) throw new Error("Square isn't set up on our side yet. Please contact support.");
  return s;
}

function origin(): string {
  const o = process.env["PUBLIC_APP_ORIGIN"];
  if (!o) throw new Error("Square isn't set up on our side yet. Please contact support.");
  return o.replace(/\/$/, "");
}

export function squareRedirectUri(): string {
  return `${origin()}/api/public/square-oauth/callback`;
}

// ---- Signed OAuth state: the public callback must be able to trust which salon it is for. ----

type StatePayload = { salonId: string; userId: string; exp: number; nonce: string };

export function signSquareState(salonId: string, userId: string): string {
  const payload: StatePayload = { salonId, userId, exp: Date.now() + 15 * 60_000, nonce: randomBytes(8).toString("hex") };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", appSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySquareState(state: string): StatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", appSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    if (!payload.salonId || !payload.userId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function squareAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    scope: SQUARE_SCOPES.join(" "),
    session: "false",
    state,
  });
  return `${BASE}/oauth2/authorize?${params.toString()}`;
}

// ---- Token exchange / refresh / revoke ----

async function tokenRequest(body: Record<string, string>): Promise<SquareTokens> {
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": VERSION },
    body: JSON.stringify({ client_id: appId(), client_secret: appSecret(), ...body }),
  });
  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string; expires_at?: string; merchant_id?: string; message?: string }
    | null;
  if (!res.ok || !data?.access_token || !data.refresh_token || !data.merchant_id) {
    console.error("square token request failed", res.status, data?.message ?? "");
    throw new Error("Square didn't finish the connection. Please try again.");
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at ?? "", merchantId: data.merchant_id };
}

export function exchangeSquareCode(code: string): Promise<SquareTokens> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: squareRedirectUri() });
}

function refreshSquareTokens(t: SquareTokens): Promise<SquareTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: t.refreshToken });
}

export async function revokeSquareToken(accessToken: string): Promise<void> {
  await fetch(`${BASE}/oauth2/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": VERSION, Authorization: `Client ${appSecret()}` },
    body: JSON.stringify({ client_id: appId(), access_token: accessToken }),
  }).catch(() => undefined);
}

// ---- Encrypted per-salon storage (reuses salon_calendar_connections, provider='square') ----

export async function getSquareConnection(salonId: string): Promise<SquareConnection | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("salon_calendar_connections")
    .select("calendar_id,calendar_summary,connection_key_ciphertext,updated_at")
    .eq("salon_id", salonId)
    .eq("provider", "square")
    .maybeSingle();
  if (error) { console.error("square connection read", error.message); throw new Error("Couldn't read your Square connection. Please try again."); }
  if (!data?.connection_key_ciphertext) return null;
  return {
    tokens: JSON.parse(decryptConnectionKey(data.connection_key_ciphertext)) as SquareTokens,
    locationId: data.calendar_id,
    businessName: data.calendar_summary ?? "",
    updatedAt: data.updated_at,
  };
}

export async function saveSquareConnection(salonId: string, userId: string, tokens: SquareTokens, locationId: string, businessName: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("salon_calendar_connections").upsert(
    {
      salon_id: salonId,
      provider: "square",
      user_id: userId,
      calendar_id: locationId,
      calendar_summary: businessName,
      connection_key_ciphertext: encryptConnectionKey(JSON.stringify(tokens)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "salon_id" },
  );
  if (error) { console.error("square connection save", error.message); throw new Error("Couldn't save your Square connection. Please try again."); }
}

export async function deleteSquareConnection(salonId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("salon_calendar_connections").delete().eq("salon_id", salonId).eq("provider", "square");
  if (error) { console.error("square connection delete", error.message); throw new Error("Couldn't remove your Square connection. Please try again."); }
}

// ---- Authenticated API access, refreshing the token when it's close to expiry ----

export type SquareApi = (path: string, init?: RequestInit) => Promise<unknown>;

export async function squareClientFor(salonId: string): Promise<{ api: SquareApi; locationId: string; businessName: string } | null> {
  const conn = await getSquareConnection(salonId);
  if (!conn) return null;
  let tokens = conn.tokens;
  // Square access tokens last ~30 days; refresh a week early so bookings never hit a dead token.
  if (!tokens.expiresAt || Date.parse(tokens.expiresAt) < Date.now() + 7 * 24 * 3600_000) {
    try {
      tokens = await refreshSquareTokens(tokens);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin.from("salon_calendar_connections").select("user_id").eq("salon_id", salonId).eq("provider", "square").single();
      await saveSquareConnection(salonId, row?.user_id ?? "", tokens, conn.locationId, conn.businessName);
    } catch (e) {
      console.error("square token refresh", e instanceof Error ? e.message : e);
      return null; // caller treats as calendar_not_connected
    }
  }
  const api: SquareApi = async (path, init = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": VERSION,
        ...(init.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => null)) as { errors?: { detail?: string }[] } | null;
    if (!res.ok) {
      console.error("square api", path, res.status, body?.errors?.[0]?.detail ?? "");
      throw new Error("Square couldn't complete that request. Please try again.");
    }
    return body;
  };
  return { api, locationId: conn.locationId, businessName: conn.businessName };
}

/** Business name + first active location, used right after OAuth completes. */
export async function fetchMerchantProfile(tokens: SquareTokens): Promise<{ businessName: string; locationId: string }> {
  const api: SquareApi = async (path) => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json", "Square-Version": VERSION },
    });
    if (!res.ok) throw new Error("Couldn't read the Square account details.");
    return res.json();
  };
  const merchant = (await api(`/v2/merchants/${tokens.merchantId}`)) as { merchant?: { business_name?: string } };
  const locations = (await api("/v2/locations")) as { locations?: { id: string; status?: string; name?: string }[] };
  const active = (locations.locations ?? []).filter((l) => l.status === "ACTIVE");
  const locationId = active[0]?.id ?? locations.locations?.[0]?.id;
  if (!locationId) throw new Error("This Square account has no location to book into.");
  return { businessName: merchant.merchant?.business_name ?? active[0]?.name ?? "Square", locationId };
}
