import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_call",
  title: "Get call transcript",
  description: "Get one call's summary and full transcript.",
  inputSchema: { call_id: z.string().uuid().describe("Call id from list_calls.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ call_id }, ctx) => {
    const { data, error } = await supabaseForUser(ctx).from("calls")
      .select("id,started_at,duration_secs,customer_phone,outcome,title,summary,transcript").eq("id", call_id).maybeSingle();
    if (error) throw new ToolError("Could not load the call.");
    if (!data) throw new ToolError("Call not found.");
    const lines = (Array.isArray(data.transcript) ? data.transcript : []) as { role?: string; text?: string; t?: number }[];
    const call = { ...data, transcript: lines.map((l) => ({ role: String(l.role ?? ""), text: String(l.text ?? ""), t: Number(l.t ?? 0) })) };
    return { content: [{ type: "text", text: JSON.stringify(call) }], structuredContent: { call } };
  },
});
