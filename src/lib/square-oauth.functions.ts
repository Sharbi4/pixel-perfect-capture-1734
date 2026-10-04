// Square connection for each salon location. Owners/managers authorize their own Square
// merchant; the server stores tokens encrypted and swaps the salon's booking provider to
// Square. Owners/managers only — staff can view status but not change it.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteSquareConnection,
  getSquareConnection,
  signSquareState,
  squareAuthorizeUrl,
  squareClientFor,
  revokeSquareToken,
} from "./square-client.server";

const Id = z.object({ salonId: z.string().uuid() });

async function role(sb: { from: (t: "salon_members") => any }, salonId: string, userId: string): Promise<string | null> {
  const { data } = await sb.from("salon_members").select("role").eq("salon_id", salonId).eq("user_id", userId).maybeSingle();
  return data?.role ?? null;
}

/** Builds the Square authorize URL with a signed state the public callback can trust. */
export const startSquareConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw new Error("Only owners and managers can connect Square.");
    return { authorizationUrl: squareAuthorizeUrl(signSquareState(data.salonId, context.userId)) };
  });

/** Connection state for the Salon Agent page: connected, needs re-auth, or not connected. */
export const getSquareStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await role(context.supabase, data.salonId, context.userId))) throw new Error("You don't have access to this location.");
    const conn = await getSquareConnection(data.salonId);
    if (!conn) return { connected: false as const };
    // Probe the merchant endpoint; a dead token (revoked in Square) shows as reconnectRequired.
    const client = await squareClientFor(data.salonId);
    if (!client) return { connected: true as const, businessName: conn.businessName, updatedAt: conn.updatedAt, reachable: false, reconnectRequired: true };
    try {
      await client.api(`/v2/merchants/${conn.tokens.merchantId}`);
      return { connected: true as const, businessName: conn.businessName || "Square", updatedAt: conn.updatedAt, reachable: true, reconnectRequired: false };
    } catch {
      return { connected: true as const, businessName: conn.businessName, updatedAt: conn.updatedAt, reachable: false, reconnectRequired: true };
    }
  });

/** Disconnects this salon's Square account and returns booking to Salon Pro Scheduling. */
export const disconnectSquare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw new Error("Only owners and managers can disconnect Square.");
    const conn = await getSquareConnection(data.salonId);
    if (conn) await revokeSquareToken(conn.tokens.accessToken);
    await deleteSquareConnection(data.salonId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("salons").select("booking_provider").eq("id", data.salonId).single();
    if (s?.booking_provider === "square") {
      await supabaseAdmin.from("salons").update({ booking_provider: "salon_pro" }).eq("id", data.salonId);
    }
    return { ok: true };
  });

type SquareCatalogItem = {
  id: string;
  item_data?: {
    name?: string;
    description?: string;
    variations?: { id: string; item_variation_data?: { name?: string; price_money?: { amount?: number }; service_duration?: number } }[];
  };
};

/**
 * Pulls the salon's Square catalog into its service list. Only adds services whose name isn't
 * already present — it never edits or removes existing services, so the live menu is never
 * silently overwritten.
 */
export const importSquareServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw new Error("Only owners and managers can import services.");
    const client = await squareClientFor(data.salonId);
    if (!client) throw new Error("Connect Square first.");
    const catalog = (await client.api("/v2/catalog/list?types=ITEM")) as { objects?: SquareCatalogItem[] };
    const items = catalog.objects ?? [];
    const { data: existing } = await context.supabase.from("services").select("name").eq("salon_id", data.salonId);
    const names = new Set((existing ?? []).map((s: { name: string }) => s.name.trim().toLowerCase()));
    let added = 0;
    let skipped = 0;
    let position = (existing ?? []).length;
    for (const item of items) {
      const itemName = item.item_data?.name?.trim();
      if (!itemName) continue;
      for (const variation of item.item_data?.variations ?? []) {
        const v = variation.item_variation_data;
        const name = v?.name && v.name !== "Regular" ? `${itemName} — ${v.name}` : itemName;
        if (names.has(name.trim().toLowerCase())) { skipped += 1; continue; }
        const price = (v?.price_money?.amount ?? 0) / 100;
        const minutes = v?.service_duration ? Math.round(v.service_duration / 60000) : 60;
        const { error } = await context.supabase.from("services").insert({
          salon_id: data.salonId,
          name,
          price,
          minutes,
          position: position++,
          description: item.item_data?.description ?? "",
          details: { source: "square", square_variation_id: variation.id },
        });
        if (!error) { added += 1; names.add(name.trim().toLowerCase()); }
      }
    }
    return { added, skipped };
  });
