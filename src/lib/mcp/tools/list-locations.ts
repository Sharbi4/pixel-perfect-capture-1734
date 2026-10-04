import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_locations",
  title: "List salon locations",
  description: "List the salon locations the signed-in user can access, with their role and receptionist status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("salon_members")
      .select("role, salon:salons(id,name,address,status,phone_number,has_receptionist)")
      .eq("user_id", ctx.getUserId() ?? "");
    if (error) throw new ToolError("Could not load locations.");
    const locations = (data ?? []).flatMap((r) => {
      const s = r.salon as unknown as { id: string; name: string; address: string; status: string; phone_number: string; has_receptionist: boolean | null } | null;
      return s ? [{ id: s.id, name: s.name, address: s.address, status: s.status, agent_number: s.phone_number, receptionist_ready: !!s.has_receptionist, role: String(r.role) }] : [];
    });
    return { content: [{ type: "text", text: JSON.stringify(locations) }], structuredContent: { locations } };
  },
});
