// Business knowledge + service catalog writes. Owners/managers only; every saved change re-syncs the salon's own agent.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { KnowledgeSchema } from "./knowledge";

type Ctx = { supabase: any; userId: string };
async function manager(ctx: Ctx, salonId: string) {
  const { data } = await ctx.supabase.from("salon_members").select("role").eq("salon_id", salonId).eq("user_id", ctx.userId).maybeSingle();
  if (!data || data.role === "staff") throw new Error("Only owners and managers can change this.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function sync(sb: any, salonId: string) {
  const { syncSalonAgent } = await import("./agent-sync.server");
  return syncSalonAgent(sb, salonId).catch(() => "failed" as const);
}
const fail = (m: string) => (e: { message: string } | null) => { if (e) { console.error(m, e.message); throw new Error("Couldn't save that change. Please try again."); } };
const line = (max: number) => z.string().max(max).transform((s) => s.replace(/[\u0000-\u001f<>{}`]/g, " ").trim());

const Basics = z.object({
  name: line(120), address: line(300), phone: line(30), website: line(300), hours: z.string().max(600).transform((s) => s.replace(/[<>{}`]/g, " ").trim()),
  deposit_policy: line(600), cancellation_policy: line(600), walk_ins: z.boolean(),
});

export const saveKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid(), basics: Basics, knowledge: KnowledgeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await manager(context, data.salonId);
    fail("knowledge")((await sb.from("salons").update({ ...data.basics, knowledge: data.knowledge, updated_at: new Date().toISOString() }).eq("id", data.salonId)).error);
    return { sync: await sync(sb, data.salonId) };
  });

export const ServiceInput = z.object({
  id: z.string().uuid().optional(),
  name: line(120).pipe(z.string().min(1, "Service name is required")),
  price: z.number().min(0).max(10000),
  minutes: z.number().int().min(5).max(600),
  is_addon: z.boolean(),
  description: line(500),
  deposit_cents: z.number().int().min(0).max(100000),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  staff_ids: z.array(z.string().uuid()).max(100).optional(),
});
type SvcIn = z.infer<typeof ServiceInput>;

/** Who does which service lives on staff.service_ids ([] = all services). */
async function assignStaff(sb: any, salonId: string, serviceId: string, staffIds: string[]) {
  const { data: staff } = await sb.from("staff").select("id,service_ids").eq("salon_id", salonId);
  const { data: all } = await sb.from("services").select("id").eq("salon_id", salonId);
  const allIds: string[] = (all ?? []).map((x: { id: string }) => x.id);
  for (const t of staff ?? []) {
    const cur: string[] = t.service_ids.length ? t.service_ids : allIds;
    const want = staffIds.includes(t.id);
    const next = want ? [...new Set([...cur, serviceId])] : cur.filter((x) => x !== serviceId);
    const norm = next.length >= allIds.length && allIds.every((x) => next.includes(x)) ? [] : next;
    if (JSON.stringify(norm) !== JSON.stringify(t.service_ids)) fail("staff")((await sb.from("staff").update({ service_ids: norm }).eq("id", t.id)).error);
  }
}

async function upsert(sb: any, salonId: string, s: SvcIn, position?: number) {
  const row = { name: s.name, price: s.price, minutes: s.minutes, is_addon: s.is_addon, description: s.description, deposit_cents: s.deposit_cents, days: [...new Set(s.days)].sort() };
  if (s.id) {
    const r = await sb.from("services").update(row).eq("id", s.id).eq("salon_id", salonId).select("id").maybeSingle();
    fail("svc update")(r.error); if (!r.data) throw new Error("That service no longer exists.");
    return s.id;
  }
  const { data: last } = await sb.from("services").select("position").eq("salon_id", salonId).order("position", { ascending: false }).limit(1).maybeSingle();
  const r = await sb.from("services").insert({ ...row, salon_id: salonId, position: position ?? (last?.position ?? -1) + 1 }).select("id").single();
  fail("svc insert")(r.error);
  return r.data.id as string;
}

export const saveService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid(), service: ServiceInput }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await manager(context, data.salonId);
    const id = await upsert(sb, data.salonId, data.service);
    if (data.service.staff_ids) await assignStaff(sb, data.salonId, id, data.service.staff_ids);
    return { id, sync: await sync(sb, data.salonId) };
  });

export const setServiceArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid(), id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await manager(context, data.salonId);
    fail("archive")((await sb.from("services").update({ archived: data.archived }).eq("id", data.id).eq("salon_id", data.salonId)).error);
    return { sync: await sync(sb, data.salonId) };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await manager(context, data.salonId);
    const { count } = await sb.from("appointments").select("id", { count: "exact", head: true }).eq("service_id", data.id);
    if (count) throw new Error("This service has appointments on record. Archive it instead so history stays intact.");
    fail("delete")((await sb.from("services").delete().eq("id", data.id).eq("salon_id", data.salonId)).error);
    const { data: staff } = await sb.from("staff").select("id,service_ids").eq("salon_id", data.salonId).contains("service_ids", [data.id]);
    for (const t of staff ?? []) await sb.from("staff").update({ service_ids: t.service_ids.filter((x: string) => x !== data.id) }).eq("id", t.id);
    return { sync: await sync(sb, data.salonId) };
  });

/** Parse an uploaded menu into proposed services. Writes nothing. */
export const parseMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ salonId: z.string().uuid(), kind: z.enum(["pdf", "image", "text"]), data: z.string().max(14_000_000), mediaType: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await manager(context, data.salonId);
    const {data:paidSalon,error:paidError}=await admin.from("salons").select("paid_access_until").eq("id",data.salonId).single();
    const {requirePaidAccess}=await import("./billing.server");
    if(paidError)throw Error("Could not verify your plan.");
    requirePaidAccess(paidSalon);
    const { extractServicesWithAI } = await import("./ai.server");
    try {
      const parts = data.kind === "image" ? [{ type: "text" as const, text: "Service menu photo:" }, { type: "image" as const, image: data.data, mediaType: data.mediaType }]
        : data.kind === "pdf" ? [{ type: "text" as const, text: "Service menu PDF:" }, { type: "file" as const, data: data.data, mediaType: "application/pdf", filename: "menu.pdf" }]
        : [{ type: "text" as const, text: `Price list / spreadsheet rows:\n${data.data.slice(0, 60_000)}` }];
      const services = await extractServicesWithAI(parts);
      return { services, error: services.length ? null : "We couldn't find any services in that file." };
    } catch (e) {
      console.error("parse menu", e);
      return { services: [], error: "We couldn't read that menu. Try a clearer photo, a PDF, or a CSV." };
    }
  });

/** Apply only the changes the owner approved. Removals archive, never delete. */
export const applyMenuChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    salonId: z.string().uuid(),
    add: z.array(ServiceInput.omit({ id: true })).max(80),
    update: z.array(z.object({ id: z.string().uuid(), price: z.number().min(0).max(10000), minutes: z.number().int().min(5).max(600), is_addon: z.boolean() })).max(200),
    archive: z.array(z.string().uuid()).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await manager(context, data.salonId);
    for (const u of data.update) fail("menu update")((await sb.from("services").update({ price: u.price, minutes: u.minutes, is_addon: u.is_addon, archived: false }).eq("id", u.id).eq("salon_id", data.salonId)).error);
    if (data.archive.length) fail("menu archive")((await sb.from("services").update({ archived: true }).in("id", data.archive).eq("salon_id", data.salonId)).error);
    for (const a of data.add) await upsert(sb, data.salonId, a);
    return { sync: await sync(sb, data.salonId), counts: { added: data.add.length, updated: data.update.length, archived: data.archive.length } };
  });
