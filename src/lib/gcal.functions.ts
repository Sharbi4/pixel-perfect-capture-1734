// Google Calendar connection for each salon location. Owners/managers authorize their own
// Google account; the server stores the connection key encrypted and swaps the salon's
// booking provider to Google. Owners/managers only — staff can view status but not change it.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appUserReconnectRequired,
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import { deleteSalonConnection, getSalonConnection, saveSalonConnection } from "./gcal-connections.server";

const GATEWAY = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
];

const Id = z.object({ salonId: z.string().uuid() });

async function role(sb: { from: (t: "salon_members") => any }, salonId: string, userId: string): Promise<string | null> {
  const { data } = await sb.from("salon_members").select("role").eq("salon_id", salonId).eq("user_id", userId).maybeSingle();
  return data?.role ?? null;
}

/** The gateway callback always lands on our public /oauth/google_calendar/return page. */
function returnUrl(): string {
  const request = getRequest();
  if (!request) throw new Error("OAuth must start from an app request.");
  const url = new URL(request.url);
  // x-forwarded-host is proxy-sanitized only behind the sandbox's localhost rewrite;
  // elsewhere it is client-spoofable, so trust the request URL.
  const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  return new URL("/oauth/google_calendar/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
}

function clientApiKey(): string {
  const key = process.env["GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY"];
  if (!key) throw new Error("Google Calendar isn't set up on our side yet. Please contact support.");
  return key;
}

async function probeCalendar(salonId: string): Promise<{ ok: boolean; reconnectRequired: boolean }> {
  const conn = await getSalonConnection(salonId);
  if (!conn) return { ok: false, reconnectRequired: false };
  try {
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY,
      connectionAPIKey: conn.connectionKey,
      connectorId: CONNECTOR_ID,
      path: `/calendar/v3/calendars/${encodeURIComponent(conn.calendarId)}/events?timeMin=${encodeURIComponent(new Date().toISOString())}&maxResults=1&singleEvents=true`,
      requiredScopes: GOOGLE_SCOPES,
    });
    if (await appUserReconnectRequired(res)) return { ok: false, reconnectRequired: true };
    return { ok: res.ok, reconnectRequired: false };
  } catch {
    return { ok: false, reconnectRequired: false };
  }
}

/** Starts (or restarts) the per-salon Google OAuth consent in a popup window. */
export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw new Error("Only owners and managers can connect a calendar.");
    const connectionAPIKey = (await getSalonConnection(data.salonId))?.connectionKey ?? undefined;
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientApiKey(),
      returnUrl: returnUrl(),
      connectionAPIKey,
      credentialsConfiguration: { scopes: GOOGLE_SCOPES },
    });
    return { authorizationUrl };
  });

/** Exchanges the popup's one-time code for the connection key and stores it for this salon. */
export const completeGoogleCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ code: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw new Error("Only owners and managers can connect a calendar.");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY, data.code);
    if (connectorId !== CONNECTOR_ID) throw new Error("OAuth completion returned the wrong connector");
    await saveSalonConnection(data.salonId, context.userId, connectionAPIKey);
    // This salon's bookings now flow through its Google Calendar.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("salons").update({ booking_provider: "google" }).eq("id", data.salonId);
    const probe = await probeCalendar(data.salonId);
    return { ok: true, verified: probe.ok };
  });

/** Connection state for the Salon Agent page: connected, needs re-auth, or not connected. */
export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await role(context.supabase, data.salonId, context.userId))) throw new Error("You don't have access to this location.");
    const conn = await getSalonConnection(data.salonId);
    if (!conn) return { connected: false as const };
    const probe = await probeCalendar(data.salonId);
    return {
      connected: true as const,
      calendarSummary: conn.calendarSummary || "Google Calendar",
      updatedAt: conn.updatedAt,
      reachable: probe.ok,
      reconnectRequired: probe.reconnectRequired || !probe.ok,
    };
  });

/** Disconnects this salon's Google Calendar and returns booking to Salon Pro Scheduling. */
export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase, data.salonId, context.userId);
    if (!r || r === "staff") throw new Error("Only owners and managers can disconnect a calendar.");
    const conn = await getSalonConnection(data.salonId);
    if (conn) {
      try {
        await disconnectAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey: conn.connectionKey, connectorId: CONNECTOR_ID });
      } catch (e) {
        // The gateway may already have revoked this grant; still clear our copy.
        console.error("gcal gateway disconnect", e instanceof Error ? e.message : e);
      }
    }
    await deleteSalonConnection(data.salonId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("salons").select("booking_provider").eq("id", data.salonId).single();
    if (s?.booking_provider === "google") {
      await supabaseAdmin.from("salons").update({ booking_provider: "salon_pro" }).eq("id", data.salonId);
    }
    return { ok: true };
  });
