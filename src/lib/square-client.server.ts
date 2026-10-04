// Server-only. Per-salon Square OAuth tokens: stored encrypted, refreshed before expiry,
// and never returned to the browser. Each salon has its own merchant connection.
import { decryptConnectionKey, encryptConnectionKey } from "./connectionKeyCrypto.server";

export const SQUARE_BASE = "https://connect.squareup.com";
export const SQUARE_VERSION = "2025-01-23";
export const SQUARE_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "ITEMS_READ",
  "APPOINTMENTS_READ",
  "APPOINTMENTS_WRITE",
  "APPOINTMENTS_BUSINESS_SETTINGS_READ",
  "APPOINTMENTS_ALL_READ",
  "APPOINTMENTS_ALL_WRITE",
  "EMPLOYEES_READ",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
];

export class SquareReconnectRequired extends Error {
  constructor() { super("square_reconnect_required"); }
}

export type SquareConn = {
  salonId: string;
  merchantId: string;
  merchantName: string;
  locationId: string;
  locationName: string;
  accessToken: string;
  reconnectRequired: boolean;
  updatedAt: string;
};

export function squareApp() {
  const id = process.env["SQUARE_APPLICATION_ID"];
  const secret = process.env["SQUARE_OAUTH_SECRET"];
  if (!id || !secret) throw new Error("Square isn't set up on our side yet. Please contact support.");
  return { id, secret };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

type TokenResp = { access_token?: string; refresh_token?: string; expires_at?: string; merchant_id?: string; errors?: unknown };

export async function exchangeToken(body: Record<string, string>): Promise<TokenResp> {
  const { id, secret } = squareApp();
  const res = await fetch(`${SQUARE_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
    body: JSON.stringify({ client_id: id, client_secret: secret, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResp;
  if (!res.ok || !json.access_token) {
    console.error("square token", res.status, JSON.stringify(json.errors ?? json).slice(0, 300));
    throw new Error(res.status === 400 || res.status === 401 ? "square_token_rejected" : "square_token_failed");
  }
  return json;
}

export async function saveSquareTokens(salonId: string, userId: string, t: TokenResp, extra: Record<string, unknown> = {}) {
  const sb = await admin();
  const { error } = await sb.from("salon_square_connections").upsert(
    {
      salon_id: salonId,
      user_id: userId,
      merchant_id: t.merchant_id ?? "",
      access_token_ciphertext: encryptConnectionKey(t.access_token!),
      refresh_token_ciphertext: encryptConnectionKey(t.refresh_token ?? ""),
      expires_at: t.expires_at ?? new Date(Date.now() + 30 * 86400000).toISOString(),
      scopes: SQUARE_SCOPES.join(" "),
      reconnect_required: false,
      updated_at: new Date().toISOString(),
      ...extra,
    },
    { onConflict: "salon_id" },
  );
  if (error) throw new Error(`save square connection: ${error.message}`);
}

/** Loads the salon's Square connection, refreshing the access token when it's within 7 days of expiry. */
export async function getSquareConnection(salonId: string): Promise<SquareConn | null> {
  const sb = await admin();
  const { data: row } = await sb.from("salon_square_connections").select("*").eq("salon_id", salonId).maybeSingle();
  if (!row) return null;
  let accessToken = decryptConnectionKey(row.access_token_ciphertext);
  let reconnect = row.reconnect_required as boolean;
  if (!reconnect && Date.parse(row.expires_at) - Date.now() < 7 * 86400000) {
    try {
      const refresh = decryptConnectionKey(row.refresh_token_ciphertext);
      const t = await exchangeToken({ grant_type: "refresh_token", refresh_token: refresh });
      await sb.from("salon_square_connections").update({
        access_token_ciphertext: encryptConnectionKey(t.access_token!),
        refresh_token_ciphertext: encryptConnectionKey(t.refresh_token ?? refresh),
        expires_at: t.expires_at,
        updated_at: new Date().toISOString(),
      }).eq("salon_id", salonId);
      accessToken = t.access_token!;
    } catch (e) {
      if ((e as Error).message === "square_token_rejected") {
        reconnect = true;
        await sb.from("salon_square_connections").update({ reconnect_required: true }).eq("salon_id", salonId);
      } else if (Date.parse(row.expires_at) < Date.now()) reconnect = true;
    }
  }
  return {
    salonId,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    locationId: row.location_id,
    locationName: row.location_name,
    accessToken,
    reconnectRequired: reconnect,
    updatedAt: row.updated_at,
  };
}

export async function markSquareReconnect(salonId: string) {
  const sb = await admin();
  await sb.from("salon_square_connections").update({ reconnect_required: true }).eq("salon_id", salonId);
}

/** Calls the Square API as this salon's merchant. Throws SquareReconnectRequired on 401. */
export async function squareApi<T = any>(conn: SquareConn, path: string, init?: RequestInit): Promise<T> {
  if (conn.reconnectRequired) throw new SquareReconnectRequired();
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    await markSquareReconnect(conn.salonId);
    throw new SquareReconnectRequired();
  }
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const code = json?.errors?.[0]?.code ?? "";
    const err = new Error(`Square ${path} [${res.status}] ${code}: ${JSON.stringify(json?.errors ?? "").slice(0, 300)}`) as Error & { code?: string; status?: number };
    err.code = code; err.status = res.status;
    throw err;
  }
  return json as T;
}

export async function deleteSquareConnection(salonId: string) {
  const sb = await admin();
  await sb.from("salon_square_connections").delete().eq("salon_id", salonId);
}

/** Bookable Square services: one entry per item variation. */
export type SquareService = { itemId: string; variationId: string; version: number; name: string; price: number; minutes: number; is_addon: boolean; description: string };

export async function listSquareServices(conn: SquareConn): Promise<SquareService[]> {
  const out: SquareService[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ types: "ITEM" });
    if (cursor) q.set("cursor", cursor);
    const r = await squareApi<{ objects?: any[]; cursor?: string }>(conn, `/v2/catalog/list?${q}`);
    for (const o of r.objects ?? []) {
      const d = o.item_data ?? {};
      if (o.is_deleted || d.is_archived) continue;
      if (d.product_type && d.product_type !== "APPOINTMENTS_SERVICE") continue;
      const vars = (d.variations ?? []).filter((v: any) => !v.is_deleted);
      for (const v of vars) {
        const vd = v.item_variation_data ?? {};
        if (vd.available_for_booking === false) continue;
        if (conn.locationId && v.present_at_all_locations === false && !(v.present_at_location_ids ?? []).includes(conn.locationId)) continue;
        const name = vars.length > 1 && vd.name && vd.name !== "Regular" ? `${d.name} - ${vd.name}` : d.name;
        out.push({
          itemId: o.id,
          variationId: v.id,
          version: Number(v.version ?? 0),
          name: String(name ?? "").slice(0, 120),
          price: Number(vd.price_money?.amount ?? 0) / 100,
          minutes: Math.max(5, Math.round(Number(vd.service_duration ?? 1800000) / 60000)),
          is_addon: false,
          description: String(d.description ?? "").slice(0, 500),
        });
      }
    }
    cursor = r.cursor;
    if (!cursor) break;
  }
  return out;
}
