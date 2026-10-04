import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_messages",
  title: "List text messages",
  description: "List recent text messages between a salon location and its clients, newest first.",
  inputSchema: {
    salon_id: z.string().uuid().describe("Location id from list_locations."),
    customer_phone: z.string().optional().describe("Only messages with this client phone number (E.164)."),
    limit: z.number().int().min(1).max(200).default(50).describe("How many messages to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ salon_id, customer_phone, limit }, ctx) => {
    let q = supabaseForUser(ctx).from("messages").select("id,sent_at,direction,customer_phone,body").eq("salon_id", salon_id);
    if (customer_phone) q = q.eq("customer_phone", customer_phone);
    const { data, error } = await q.order("sent_at", { ascending: false }).limit(limit);
    if (error) throw new ToolError("Could not load messages.");
    const messages = (data ?? []).map((m) => ({ ...m }));
    return { content: [{ type: "text", text: messages.length ? JSON.stringify(messages) : "No texts saved for this location yet." }], structuredContent: { messages } };
  },
});
