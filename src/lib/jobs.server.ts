// Server-only access to backend phone jobs (service role; callers must verify ownership first).
import type { JobHandle, JobStore } from "./provisioning";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export type JobKind = "purchase_number" | "create_agent";

export function jobStore(salonId: string, kind: JobKind): JobStore {
  return {
    async begin(key) {
      const sb = await admin();
      const { data, error } = await sb.rpc("begin_phone_job", { p_salon: salonId, p_kind: kind, p_key: key });
      if (error || !data?.[0]) throw new Error("job_unavailable");
      return data[0] as JobHandle;
    },
    async setTarget(jobId, token, target) {
      const sb = await admin();
      const { data, error } = await sb.rpc("set_phone_job_target", { p_job: jobId, p_token: token, p_target: target });
      return !error && data === true;
    },
    async transition(jobId, token, to, ref, err) {
      const sb = await admin();
      const { data, error } = await sb.rpc("transition_phone_job", {
        p_job: jobId, p_token: token as string, p_to: to, p_ref: ref, p_error: err,
      });
      if (error) console.error("transition_phone_job failed", error.message);
      return !error && data === true;
    },
  };
}

export async function openJobs(salonId: string) {
  const sb = await admin();
  const { data } = await sb
    .from("phone_jobs")
    .select("id,kind,state,target,idempotency_key,locked_at")
    .eq("salon_id", salonId)
    .in("state", ["uncertain", "in_progress"]);
  return data ?? [];
}

export async function adminClient() { return admin(); }
