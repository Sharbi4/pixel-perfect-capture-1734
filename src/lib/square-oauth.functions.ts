// Square connection for each salon location. Owners/managers authorize their own Square
// account; tokens stay server-side (encrypted). Staff can view status only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normName } from "./menu-diff";

const Id = z.object({ salonId: z.string().uuid() });
type Ctx = { supabase: any; userId: string };

async function roleOf(ctx: Ctx, salonId: string): Promise<string | null> {
  const { data } = await ctx.supabase.from("salon_members").select("role").eq("salon_id", salonId).eq("user_id", ctx.userId).maybeSingle();
  return data?.role ?? null;
}
async function manager(ctx: Ctx, salonId: string) {
  const r = await roleOf(ctx, salonId);
  if (!r || r === "staff") throw new Error("Only owners and managers can change the Square connection.");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function connOrThrow(salonId: string) {
  const { getSquareConnection } = await import("./square-client.server");
  const c = await getSquareConnection(salonId);
  if (!c) throw new Error("Square isn't connected for this location.");
  if (c.reconnectRequired) throw new Error("Your Square access needs to be renewed. Click Reconnect Square.");
  return c;
}
function friendly(e: unknown): never {
  const m = (e as Error)?.message ?? "";
  if (m === "square_reconnect_required") throw new Error("Your Square access needs to be renewed. Click Reconnect Square.");
  if (m.startsWith("Square ")) { console.error(m); throw new Error("Square didn't respond as expected. Please try again."); }
  throw e;
}

export const startSquareConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    await manager(context, data.salonId);
    const { squareApp, SQUARE_BASE, SQUARE_SCOPES } = await import("./square-client.server");
    const { randomBytes } = await import("node:crypto");
    const { id } = squareApp();
    const nonce = randomBytes(24).toString("base64url");
    const sb = await admin();
    await sb.from("square_oauth_states").delete().lt("expires_at", new Date().toISOString());
    const { error } = await sb.from("square_oauth_states").insert({ nonce, salon_id: data.salonId, user_id: context.userId, expires_at: new Date(Date.now() + 15 * 60000).toISOString() });
    if (error) throw new Error("Couldn't start the Square connection. Please try again.");
    const q = new URLSearchParams({ client_id: id, scope: SQUARE_SCOPES.join(" "), session: "false", state: nonce });
    return { authorizationUrl: `${SQUARE_BASE}/oauth2/authorize?${q}` };
  });

export const getSquareStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await roleOf(context, data.salonId))) throw new Error("You don't have access to this location.");
    const { getSquareConnection, squareApi } = await import("./square-client.server");
    const c = await getSquareConnection(data.salonId);
    if (!c) return { connected: false as const };
    const sb = await admin();
    const { data: s } = await sb.from("salons").select("booking_provider").eq("id", data.salonId).single();
    let locations: { id: string; name: string }[] = [];
    let reconnect = c.reconnectRequired;
    if (!reconnect) {
      try {
        const l = await squareApi(c, "/v2/locations");
        locations = (l?.locations ?? []).filter((x: any) => x.status === "ACTIVE").map((x: any) => ({ id: x.id, name: x.name ?? x.id }));
      } catch (e) { if ((e as Error).message === "square_reconnect_required") reconnect = true; }
    }
    return {
      connected: true as const,
      merchantName: c.merchantName || "Square",
      locationId: c.locationId,
      locationName: c.locationName,
      locations,
      reconnectRequired: reconnect,
      bookingViaSquare: s?.booking_provider === "square",
      updatedAt: c.updatedAt,
    };
  });

export const setSquareLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ locationId: z.string().min(1).max(64), locationName: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await manager(context, data.salonId);
    const c = await connOrThrow(data.salonId);
    const { squareApi } = await import("./square-client.server");
    // Only accept a location that really belongs to this merchant.
    const l = await squareApi(c, `/v2/locations/${encodeURIComponent(data.locationId)}`).catch(friendly);
    const sb = await admin();
    await sb.from("salon_square_connections").update({ location_id: l.location.id, location_name: String(l.location.name ?? "").slice(0, 200) }).eq("salon_id", data.salonId);
    return { ok: true };
  });

export const setSquareBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ on: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await manager(context, data.salonId);
    const sb = await admin();
    if (data.on) {
      const c = await connOrThrow(data.salonId);
      if (!c.locationId) throw new Error("Choose your Square location first.");
      const { count } = await sb.from("services").select("id", { count: "exact", head: true }).eq("salon_id", data.salonId).eq("archived", false).neq("square_variation_id", "");
      if (!count) throw new Error("Import your Square services first so the agent knows what it can book.");
    }
    await sb.from("salons").update({ booking_provider: data.on ? "square" : "salon_pro" }).eq("id", data.salonId);
    const { syncSalonAgent } = await import("./agent-sync.server");
    await syncSalonAgent(sb, data.salonId).catch(() => null);
    return { ok: true };
  });

export const disconnectSquare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    await manager(context, data.salonId);
    const { getSquareConnection, deleteSquareConnection, squareApp, SQUARE_BASE, SQUARE_VERSION } = await import("./square-client.server");
    const c = await getSquareConnection(data.salonId).catch(() => null);
    if (c) {
      try {
        const { id, secret } = squareApp();
        await fetch(`${SQUARE_BASE}/oauth2/revoke`, {
          method: "POST",
          headers: { Authorization: `Client ${secret}`, "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
          body: JSON.stringify({ client_id: id, access_token: c.accessToken }),
        });
      } catch (e) { console.error("square revoke", (e as Error).message); }
    }
    await deleteSquareConnection(data.salonId);
    const sb = await admin();
    const { data: s } = await sb.from("salons").select("booking_provider").eq("id", data.salonId).single();
    if (s?.booking_provider === "square") await sb.from("salons").update({ booking_provider: "salon_pro" }).eq("id", data.salonId);
    return { ok: true };
  });

/** Reads the Square services menu as a proposal for the review screen. Writes nothing. */
export const importSquareCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    await manager(context, data.salonId);
    const c = await connOrThrow(data.salonId);
    const { listSquareServices } = await import("./square-client.server");
    const svcs = await listSquareServices(c).catch(friendly);
    return {
      services: svcs.map((s) => ({ name: s.name, price: s.price, minutes: s.minutes, is_addon: s.is_addon })),
      error: svcs.length ? null : "We didn't find any bookable services in Square for this location.",
    };
  });

/** After the owner approves an import, remember which Square service each menu item is (matched by name). */
export const linkSquareServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    await manager(context, data.salonId);
    const c = await connOrThrow(data.salonId);
    const { listSquareServices } = await import("./square-client.server");
    const svcs = await listSquareServices(c).catch(friendly);
    const byName = new Map(svcs.map((s) => [normName(s.name), s.variationId]));
    const sb = await admin();
    const { data: live } = await sb.from("services").select("id,name,square_variation_id").eq("salon_id", data.salonId);
    let linked = 0;
    for (const s of live ?? []) {
      const v = byName.get(normName(s.name)) ?? "";
      if (v !== s.square_variation_id) await sb.from("services").update({ square_variation_id: v }).eq("id", s.id);
      if (v) linked++;
    }
    return { linked };
  });

/** Adds bookable Square team members as staff (matched by Square ID, then name). Never removes staff. */
export const importSquareTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    await manager(context, data.salonId);
    const c = await connOrThrow(data.salonId);
    const { squareApi } = await import("./square-client.server");
    const prof = await squareApi(c, `/v2/bookings/team-member-booking-profiles?bookable_only=true&limit=100${c.locationId ? `&location_id=${encodeURIComponent(c.locationId)}` : ""}`).catch(friendly);
    const people: { id: string; name: string }[] = (prof?.team_member_booking_profiles ?? []).map((p: any) => ({ id: p.team_member_id, name: String(p.display_name ?? "").slice(0, 80) })).filter((p: any) => p.id && p.name);
    const sb = await admin();
    const { data: staff } = await sb.from("staff").select("id,name,square_team_member_id,position").eq("salon_id", data.salonId);
    let added = 0, linked = 0;
    let pos = Math.max(-1, ...(staff ?? []).map((s: any) => s.position)) + 1;
    for (const p of people) {
      const hit = (staff ?? []).find((s: any) => s.square_team_member_id === p.id) ?? (staff ?? []).find((s: any) => !s.square_team_member_id && s.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      if (hit) {
        if (hit.square_team_member_id !== p.id) { await sb.from("staff").update({ square_team_member_id: p.id }).eq("id", hit.id); linked++; }
        continue;
      }
      const { error } = await sb.from("staff").insert({ salon_id: data.salonId, name: p.name, square_team_member_id: p.id, position: pos++ });
      if (!error) added++; else console.error("square staff insert", error.message);
    }
    return { added, linked, total: people.length };
  });
