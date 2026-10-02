// Live database checks for phone-job locking and access rules. No provider calls are made.
// Run: bun tests/db/phone-jobs.integration.ts   (needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_PUBLISHABLE_KEY and an owner session at ~/.cache/lovable-auth/session.json)
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const URL_ = process.env["SUPABASE_URL"]!;
const SR = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const ANON = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;
const session = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8")).session;
const USER_TOKEN: string = session.access_token;
const USER_ID: string = session.user.id;

let pass = 0, fail = 0;
function check(name: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`, info ?? ""); }
}

function hdr(role: "service" | "anon" | "user") {
  const h: Record<string, string> = { "Content-Type": "application/json", Prefer: "return=representation" };
  if (role === "service") { h.apikey = SR; if (!SR.startsWith("sb_")) h.Authorization = `Bearer ${SR}`; }
  else { h.apikey = ANON; if (role === "user") h.Authorization = `Bearer ${USER_TOKEN}`; }
  return h;
}
async function rest(role: "service" | "anon" | "user", method: string, path: string, body?: unknown) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: hdr(role), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j: any = null; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, json: j };
}
const rpc = (role: "service" | "anon" | "user", fn: string, args: object) => rest(role, "POST", `rpc/${fn}`, args);
const begin = (salon: string, key: string, kind = "purchase_number") =>
  rpc("service", "begin_phone_job", { p_salon: salon, p_kind: kind, p_key: key }).then((r) => r.json[0]);

async function main() {
  // A throwaway salon owned by a random (non-existent) owner, so the real owner can't see it.
  const otherOwner = randomUUID();
  const ins = await rest("service", "POST", "salons", { owner_id: otherOwner, name: "ZZ Test Salon" });
  const salon: string = ins.json[0].id;
  try {
    console.log("Locking & idempotency");
    const many = await Promise.all(Array.from({ length: 8 }, (_, i) => begin(salon, `k-${i}`)));
    check("8 concurrent begins with different keys → exactly 1 acquires", many.filter((h) => h.acquired).length === 1, many);
    const winner = many.find((h) => h.acquired);
    check("all callers see the same single active job", new Set(many.map((h) => h.job_id)).size === 1);
    const again = await begin(salon, "k-0");
    check("same key again → same job, not re-acquired", again.job_id === winner.job_id && !again.acquired);

    console.log("Lock-token guard");
    const bad = await rpc("service", "transition_phone_job", { p_job: winner.job_id, p_token: randomUUID(), p_to: "succeeded", p_ref: "X", p_error: "" });
    check("wrong lock token cannot finish the job", bad.json === false);
    await rpc("service", "set_phone_job_target", { p_job: winner.job_id, p_token: winner.lock_token, p_target: "+14805550999" });

    console.log("Uncertain results are not retried");
    const u = await rpc("service", "transition_phone_job", { p_job: winner.job_id, p_token: winner.lock_token, p_to: "uncertain", p_ref: "", p_error: "unconfirmed" });
    check("lock holder can mark result unclear", u.json === true);
    const retry = await begin(salon, "k-new");
    check("new key while unclear → blocked (returns the unclear job)", !retry.acquired && retry.job_state === "uncertain" && retry.job_id === winner.job_id);
    const st = await rest("service", "GET", `phone_setups?salon_id=eq.${salon}&select=temp_number_status,temp_number_error`);
    check("owner status shows needs_review with a sanitized code", st.json[0]?.temp_number_status === "needs_review" && st.json[0]?.temp_number_error === "unconfirmed", st.json);
    const resolved = await rpc("service", "transition_phone_job", { p_job: winner.job_id, p_token: null, p_to: "succeeded", p_ref: "PNTEST", p_error: "" });
    check("reconciliation can resolve unclear → succeeded", resolved.json === true);
    const s2 = await rest("service", "GET", `salons?id=eq.${salon}&select=phone_number,phone_number_sid`);
    check("success writes number + id onto the salon", s2.json[0].phone_number === "+14805550999" && s2.json[0].phone_number_sid === "PNTEST");
    const twice = await rpc("service", "transition_phone_job", { p_job: winner.job_id, p_token: null, p_to: "failed", p_ref: "", p_error: "x" });
    check("finished job cannot be transitioned again", twice.json === false);

    console.log("Stale lock becomes unclear, never re-run");
    const a = await begin(salon, "agent-1", "create_agent");
    await fetch(`${URL_}/rest/v1/phone_jobs?id=eq.${a.job_id}`, { method: "PATCH", headers: hdr("service"), body: JSON.stringify({ locked_at: new Date(Date.now() - 10 * 60_000).toISOString() }) });
    const stale = await begin(salon, "agent-2", "create_agent");
    check("stale in-progress job → uncertain, not acquired", !stale.acquired && stale.job_state === "uncertain" && stale.job_id === a.job_id, stale);
    const lateFinish = await rpc("service", "transition_phone_job", { p_job: a.job_id, p_token: a.lock_token, p_to: "succeeded", p_ref: "late", p_error: "" });
    check("original (stale) lock holder can no longer finish it", lateFinish.json === false);

    console.log("Access rules");
    const anonJobs = await rest("anon", "GET", "phone_jobs?select=id");
    check("anonymous cannot read jobs", anonJobs.status >= 400, anonJobs);
    const anonSalons = await rest("anon", "GET", "salons?select=id");
    check("anonymous cannot read salons", anonSalons.status >= 400 || (Array.isArray(anonSalons.json) && anonSalons.json.length === 0));
    const userJobs = await rest("user", "GET", "phone_jobs?select=id");
    check("signed-in owner cannot read jobs", userJobs.status >= 400, userJobs);
    const userRpc = await rpc("user", "begin_phone_job", { p_salon: salon, p_kind: "purchase_number", p_key: "evil" });
    check("signed-in owner cannot start jobs directly", userRpc.status >= 400, userRpc);
    const userTr = await rpc("user", "transition_phone_job", { p_job: winner.job_id, p_token: null, p_to: "failed", p_ref: "", p_error: "" });
    check("signed-in owner cannot change job state", userTr.status >= 400);
    const otherSetup = await rest("user", "GET", `phone_setups?salon_id=eq.${salon}&select=salon_id`);
    check("owner cannot see another salon's phone status", Array.isArray(otherSetup.json) && otherSetup.json.length === 0);

    const own = await rest("user", "GET", `salons?owner_id=eq.${USER_ID}&select=id,name`);
    const mine = own.json[0];
    if (mine) {
      for (const [field, value] of [["agent_id", "agent_forged"], ["phone_number", "+15555550100"], ["phone_number_sid", "PNforged"], ["status", "live"], ["owner_id", otherOwner], ["launched_at", new Date().toISOString()]] as const) {
        const r = await rest("user", "PATCH", `salons?id=eq.${mine.id}`, { [field]: value });
        check(`owner cannot forge salons.${field}`, r.status >= 400, r);
      }
      const ok = await rest("user", "PATCH", `salons?id=eq.${mine.id}`, { name: mine.name, updated_at: new Date().toISOString() });
      check("owner can still edit normal salon fields", ok.status < 300, ok);
      const del = await rest("user", "DELETE", `salons?id=eq.${mine.id}`);
      check("owner cannot delete their salon (no delete/recreate)", del.status >= 400, del);
      const still = await rest("user", "GET", `salons?id=eq.${mine.id}&select=id`);
      check("owner salon still exists after delete attempt", still.json.length === 1);
      const recreate = await Promise.all(Array.from({ length: 5 }, () => rest("user", "POST", "salons?select=id", { owner_id: USER_ID })));
      check("5 concurrent recreate attempts all refused (one salon per owner)", recreate.every((r) => r.status >= 400), recreate.map((r) => r.status));
      const retSid = await rest("user", "POST", "salons?select=phone_number_sid", { owner_id: USER_ID });
      check("insert cannot return provider ids", retSid.status >= 400);
      const forgedInsert = await rest("user", "POST", "salons", { owner_id: USER_ID, agent_id: "agent_forged" });
      check("owner cannot insert a salon with a provider id", forgedInsert.status >= 400);
      const otherOwnerInsert = await rest("user", "POST", "salons", { owner_id: otherOwner, name: "x" });
      check("owner cannot insert a salon for someone else", otherOwnerInsert.status >= 400);
    } else {
      console.log("  (skipped owner salon checks: owner has no salon yet)");
    }

    console.log("Delete/recreate and private fields");
    const sameKey = await Promise.all(Array.from({ length: 6 }, () => begin(salon, "dup-key", "create_agent")));
    check("6 concurrent requests with the same key → one job", new Set(sameKey.map((h) => h.job_id)).size === 1 && sameKey.filter((h) => h.acquired).length <= 1, sameKey);
    const backendDel = await rest("service", "DELETE", `salons?id=eq.${salon}`);
    check("salon with paid-resource jobs cannot be deleted, even by backend, until jobs are handled", backendDel.status >= 400, backendDel);
    const jobsLeft = await rest("service", "GET", `phone_jobs?salon_id=eq.${salon}&select=id`);
    check("job history survives the delete attempt", jobsLeft.json.length >= 2);
    for (const col of ["phone_number_sid", "agent_id", "*"]) {
      const r = await rest("user", "GET", `salons?select=${col}`);
      check(`owner cannot read salons.${col}`, r.status >= 400, r);
    }
    const safe = await rest("user", "GET", "salons?select=id,phone_number,has_receptionist");
    check("owner can read safe salon columns", safe.status === 200, safe);
    for (const [m, path, body] of [["POST", "phone_setups", { salon_id: salon }], ["PATCH", `phone_setups?salon_id=eq.${salon}`, { voice_status: "verified" }], ["DELETE", `phone_setups?salon_id=eq.${salon}`, undefined]] as const) {
      const r = await rest("user", m, path, body);
      check(`owner cannot ${m} phone_setups`, r.status >= 400, r);
    }
    const anonSvc = await rest("anon", "GET", "services?select=id");
    check("anonymous cannot read services", anonSvc.status >= 400);
  } finally {
    await rest("service", "DELETE", `phone_jobs?salon_id=eq.${salon}`);
    const d = await rest("service", "DELETE", `salons?id=eq.${salon}`);
    check("backend can remove a salon after handling its jobs", d.status < 300, d);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
