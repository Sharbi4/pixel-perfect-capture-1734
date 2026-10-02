// Provider-agnostic provisioning logic. No secrets, no env, no network — dependencies are injected
// so the rules (one attempt per intent, never auto-retry an unclear result) are unit-testable.
import { areaCodeOf } from "./phone-format";

export type Outcome<T> =
  | { kind: "ok"; value: T }
  | { kind: "rejected"; code: string } // provider definitively refused; nothing was created
  | { kind: "ambiguous"; code: string }; // we cannot know whether it was created

/** HTTP status → outcome class for create/purchase calls. */
export function classifyHttp(status: number): Outcome<never>["kind"] | "ok" {
  if (status >= 200 && status < 300) return "ok";
  if (status >= 400 && status < 500 && status !== 408) return "rejected";
  return "ambiguous";
}

export type JobHandle = {
  job_id: string; acquired: boolean; job_state: string; lock_token: string | null;
  target: string; provider_ref: string; error_code: string;
};

export interface JobStore {
  begin(key: string): Promise<JobHandle>;
  setTarget(jobId: string, token: string, target: string): Promise<boolean>;
  transition(jobId: string, token: string | null, to: "succeeded" | "failed" | "uncertain", ref: string, error: string): Promise<boolean>;
}

export type StepStatus = "done" | "in_progress" | "needs_review" | "failed";
export type StepResult = { status: StepStatus; code: string; ref: string; target: string };

function fromExisting(h: JobHandle): StepResult {
  const status: StepStatus =
    h.job_state === "succeeded" ? "done"
    : h.job_state === "uncertain" ? "needs_review"
    : h.job_state === "failed" ? "failed"
    : "in_progress";
  return { status, code: h.error_code, ref: h.provider_ref, target: h.target };
}

export type Candidate = { number: string; region: string; locality: string };

/** Same area code first; otherwise a provider-verified nearby number in the salon's state. Never an unrelated area. */
export function pickTemporaryNumber(
  business: string, byArea: Candidate[], nearby: Candidate[], addressState: string | null,
): { candidate: Candidate; reason: "same_area_code" | "nearby" } | null {
  const area = areaCodeOf(business);
  if (!area) return null;
  const valid = (c: Candidate) => /^\+1\d{10}$/.test(c.number);
  const same = byArea.find((c) => valid(c) && c.number.startsWith(`+1${area}`));
  if (same) return { candidate: same, reason: "same_area_code" };
  const near = nearby.find(
    (c) => valid(c) && !!c.region && (!addressState || c.region.toUpperCase() === addressState),
  );
  return near ? { candidate: near, reason: "nearby" } : null;
}

export interface PurchaseDeps extends JobStore {
  searchByArea(area: string): Promise<Candidate[]>;
  searchNearby(e164: string): Promise<Candidate[]>;
  buy(e164: string): Promise<Outcome<{ sid: string }>>;
}

export async function runPurchase(
  d: PurchaseDeps, input: { key: string; businessNumber: string; addressState: string | null },
): Promise<StepResult> {
  const h = await d.begin(input.key);
  if (!h.acquired || !h.lock_token) return fromExisting(h);
  const token = h.lock_token;
  const done = async (to: "succeeded" | "failed" | "uncertain", ref: string, code: string, target: string): Promise<StepResult> => {
    await d.transition(h.job_id, token, to, ref, code);
    return { status: to === "succeeded" ? "done" : to === "failed" ? "failed" : "needs_review", code, ref, target };
  };

  // Searching is read-only, so a failure here is safe to report as a clean failure.
  let pick: ReturnType<typeof pickTemporaryNumber> = null;
  try {
    const byArea = await d.searchByArea(areaCodeOf(input.businessNumber));
    pick = pickTemporaryNumber(input.businessNumber, byArea, [], input.addressState);
    if (!pick) pick = pickTemporaryNumber(input.businessNumber, [], await d.searchNearby(input.businessNumber), input.addressState);
  } catch {
    return done("failed", "", "search_failed", "");
  }
  if (!pick) return done("failed", "", "no_local_numbers", "");

  const number = pick.candidate.number;
  // Persist the exact number before buying so an unclear result can be reconciled later.
  if (!(await d.setTarget(h.job_id, token, number))) return { status: "needs_review", code: "lock_lost", ref: "", target: "" };

  let out: Outcome<{ sid: string }>;
  try { out = await d.buy(number); } catch { out = { kind: "ambiguous", code: "unconfirmed" }; }
  if (out.kind === "ok") return done("succeeded", out.value.sid, "", number);
  if (out.kind === "rejected") return done("failed", "", out.code, number);
  return done("uncertain", "", "unconfirmed", number);
}

export interface AgentDeps extends JobStore {
  create(marker: string): Promise<Outcome<{ agentId: string }>>;
}

export const agentMarker = (jobId: string) => `nd-${jobId.replace(/-/g, "").slice(0, 12)}`;

export async function runAgentCreate(d: AgentDeps, key: string): Promise<StepResult> {
  const h = await d.begin(key);
  if (!h.acquired || !h.lock_token) return fromExisting(h);
  const token = h.lock_token;
  const marker = agentMarker(h.job_id);
  if (!(await d.setTarget(h.job_id, token, marker))) return { status: "needs_review", code: "lock_lost", ref: "", target: "" };
  let out: Outcome<{ agentId: string }>;
  try { out = await d.create(marker); } catch { out = { kind: "ambiguous", code: "unconfirmed" }; }
  if (out.kind === "ok") {
    await d.transition(h.job_id, token, "succeeded", out.value.agentId, "");
    return { status: "done", code: "", ref: out.value.agentId, target: marker };
  }
  const to = out.kind === "rejected" ? "failed" : "uncertain";
  const code = out.kind === "rejected" ? out.code : "unconfirmed";
  await d.transition(h.job_id, token, to, "", code);
  return { status: to === "failed" ? "failed" : "needs_review", code, ref: "", target: marker };
}

/** Resolve an uncertain job by looking (read-only) at the provider. Never repeats the create/purchase. */
export async function reconcile(
  transition: JobStore["transition"],
  job: { id: string; target: string },
  lookup: (target: string) => Promise<Outcome<string | null>>,
  notFoundCode: string,
): Promise<StepResult> {
  if (!job.target) {
    // The provider call was never made (target is recorded first).
    await transition(job.id, null, "failed", "", notFoundCode);
    return { status: "failed", code: notFoundCode, ref: "", target: "" };
  }
  let r: Outcome<string | null>;
  try { r = await lookup(job.target); } catch { r = { kind: "ambiguous", code: "check_failed" }; }
  if (r.kind !== "ok") return { status: "needs_review", code: "check_failed", ref: "", target: job.target };
  if (r.value) {
    await transition(job.id, null, "succeeded", r.value, "");
    return { status: "done", code: "", ref: r.value, target: job.target };
  }
  await transition(job.id, null, "failed", "", notFoundCode);
  return { status: "failed", code: notFoundCode, ref: "", target: job.target };
}
