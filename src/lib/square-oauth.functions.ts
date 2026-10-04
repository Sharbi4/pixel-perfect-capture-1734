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

import { readSquareCatalog } from "./square-catalog";
const Id = z.object({ salonId: z.string().uuid() });

async function paid(salonId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requirePaidAccess } = await import("./billing.server");
  const { data, error } = await supabaseAdmin
    .from("salons")
    .select("paid_access_until")
    .eq("id", salonId)
    .single();
  if (error) throw error;
  requirePaidAccess(data);
}
async function role(
  sb: { from: (t: "salon_members") => any },
  salonId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("salon_members")
    .select("role")
    .eq("salon_id", salonId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

/** Builds the Square authorize URL with a signed state the public callback can trust. */
export const startSquareConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Id.extend({
      returnTo: z.enum(["/setup", "/dashboard/agent"]).default("/dashboard/agent"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw new Error("Only owners and managers can connect Square.");
    await paid(data.salonId);
    return {
      authorizationUrl: squareAuthorizeUrl(
        signSquareState(data.salonId, context.userId, data.returnTo),
      ),
    };
  });

/** Connection state for the Salon Agent page: connected, needs re-auth, or not connected. */
export const getSquareStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await role(context.supabase, data.salonId, context.userId)))
      throw new Error("You don't have access to this location.");
    const conn = await getSquareConnection(data.salonId);
    if (!conn) return { connected: false as const };
    // Probe the merchant endpoint; a dead token (revoked in Square) shows as reconnectRequired.
    const client = await squareClientFor(data.salonId);
    if (!client)
      return {
        connected: true as const,
        businessName: conn.businessName,
        updatedAt: conn.updatedAt,
        reachable: false,
        reconnectRequired: true,
      };
    try {
      await client.api(`/v2/merchants/${conn.tokens.merchantId}`);
      const profile = (await client.api("/v2/bookings/business-booking-profile")) as {
        business_booking_profile?: { support_seller_level_writes?: boolean };
      };
      const locationResponse = (await client.api("/v2/locations")) as {
        locations?: { id: string; name?: string; status?: string }[];
      };
      const locations = (locationResponse.locations ?? [])
        .filter((l) => l.status === "ACTIVE")
        .map((l) => ({ id: l.id, name: l.name || "Square location" }));
      const bookingCapable = profile.business_booking_profile?.support_seller_level_writes === true;
      return {
        connected: true as const,
        businessName: conn.businessName || "Square",
        updatedAt: conn.updatedAt,
        reachable: true,
        reconnectRequired: false,
        bookingCapable,
        locations,
        locationId: client.locationId,
      };
    } catch {
      return {
        connected: true as const,
        businessName: conn.businessName,
        updatedAt: conn.updatedAt,
        reachable: false,
        reconnectRequired: true,
      };
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
    const { data: s } = await supabaseAdmin
      .from("salons")
      .select("booking_provider")
      .eq("id", data.salonId)
      .single();
    if (s?.booking_provider === "square") {
      await supabaseAdmin
        .from("salons")
        .update({ booking_provider: "salon_pro" })
        .eq("id", data.salonId);
    }
    return { ok: true };
  });

async function menu(context: { supabase: any; userId: string }, salonId: string) {
  const r = await role(context.supabase, salonId, context.userId);
  if (!r || r === "staff") throw Error("Only owners and managers can import services.");
  await paid(salonId);
  const client = await squareClientFor(salonId);
  if (!client) throw Error("Connect Square first.");
  return readSquareCatalog(client.api);
}
export const previewSquareServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => ({ services: await menu(context, data.salonId) }));
/** Only selected provider IDs are accepted; prices and durations are re-read server-side. Existing rows are never overwritten. */
export const importSquareServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Id.extend({ variationIds: z.array(z.string().min(1)).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = await menu(context, data.salonId);
    const selected = new Set(data.variationIds);
    if (data.variationIds.some((id) => !rows.some((s) => s.variationId === id)))
      throw Error("The Square menu changed. Review it again before importing.");
    const { data: existing, error } = await context.supabase
      .from("services")
      .select("id,name,details")
      .eq("salon_id", data.salonId);
    if (error) throw error;
    const names = new Set((existing ?? []).map((s) => s.name.trim().toLowerCase()));
    const ids = new Set(
      (existing ?? []).map(
        (s) => (s.details as { square_variation_id?: string })?.square_variation_id,
      ),
    );
    let skipped = 0;
    const inserts = rows
      .filter((s) => selected.has(s.variationId))
      .flatMap((s) => {
        if (names.has(s.name.toLowerCase()) || ids.has(s.variationId)) {
          skipped++;
          return [];
        }
        names.add(s.name.toLowerCase());
        return [
          {
            salon_id: data.salonId,
            name: s.name,
            price: s.price,
            minutes: s.minutes,
            position: (existing ?? []).length + names.size,
            description: s.description,
            details: { source: "square", square_variation_id: s.variationId },
          },
        ];
      });
    if (inserts.length) {
      const { error } = await context.supabase.from("services").insert(inserts);
      if (error) throw error;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { syncSalonAgent } = await import("./agent-sync.server");
      await syncSalonAgent(supabaseAdmin, data.salonId).catch(() => null);
    }
    return { added: inserts.length, skipped };
  });

export const selectSquareLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ locationId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw Error("Only owners and managers can select a location.");
    await paid(data.salonId);
    const client = await squareClientFor(data.salonId);
    if (!client) throw Error("Connect Square first.");
    const response = (await client.api("/v2/locations")) as {
      locations?: { id: string; status: string }[];
    };
    if (!response.locations?.some((l) => l.id === data.locationId && l.status === "ACTIVE"))
      throw Error("Choose an active location from this Square account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("salon_calendar_connections")
      .update({ calendar_id: data.locationId, updated_at: new Date().toISOString() })
      .eq("salon_id", data.salonId)
      .eq("provider", "square")
      .select("salon_id")
      .maybeSingle();
    if (error || !updated)
      throw Error("Square connection changed. Please reconnect and try again.");
    return { ok: true };
  });
