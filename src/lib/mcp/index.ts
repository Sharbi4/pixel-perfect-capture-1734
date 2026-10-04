import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listLocations from "./tools/list-locations";
import listCalls from "./tools/list-calls";
import getCall from "./tools/get-call";
import listMessages from "./tools/list-messages";

// Issuer must be the direct auth host; the project ref is inlined at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "pixel-perfect",
  title: "Pixel Perfect",
  version: "0.1.0",
  instructions: "Read-only access to a Salon Pro Agent account. Call list_locations first to get a salon_id, then list_calls / get_call for call history and transcripts, or list_messages for client texts. Data reflects activity saved so far.",
  auth: auth.oauth.issuer({ issuer: `https://${projectRef}.supabase.co/auth/v1`, acceptedAudiences: "authenticated" }),
  tools: [listLocations, listCalls, getCall, listMessages],
});
