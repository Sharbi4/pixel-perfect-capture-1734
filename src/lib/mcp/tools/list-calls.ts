import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_calls",
  title: "List calls",
  description: "List recent calls answered by the salon's AI receptionist, newest first, with summaries.",
  inputSchema: {
    salon_id: z.string().uuid().describe("Location id from list_locations."),
    limit: z.number().int().min(1).max(100).default(20).describe("How many calls to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ salon_id, limit }, ctx) => {
    const { data, error } = await supabaseForUser(ctx).from("calls")
      .select("id,started_at,duration_secs,direction,customer_phone,outcome,title,summary")
      .eq("salon_id", salon_id).order("started_at", { ascending: false }).limit(limit);
    if (error) throw new ToolError("Could not load calls.");
    const calls = (data ?? []).map((c) => ({ ...c }));
    return { content: [{ type: "text", text: calls.length ? JSON.stringify(calls) : "No calls saved for this location yet." }], structuredContent: { calls } };
  },
});
