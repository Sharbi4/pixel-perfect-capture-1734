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
  job_id: string;
  acquired: boolean;
  job_state: string;
  lock_token: string | null;
  target: string;
  provider_ref: string;
  error_code: string;
};

export interface JobStore {
  begin(key: string): Promise<JobHandle>;
  setTarget(jobId: string, token: string, target: string): Promise<boolean>;
  transition(
    jobId: string,
    token: string | null,
    to: "succeeded" | "failed" | "uncertain",
    ref: string,
    error: string,
  ): Promise<boolean>;
}

export type StepStatus = "done" | "in_progress" | "needs_review" | "failed";
export type StepResult = { status: StepStatus; code: string; ref: string; target: string };

function fromExisting(h: JobHandle): StepResult {
  const status: StepStatus =
    h.job_state === "succeeded"
      ? "done"
      : h.job_state === "uncertain"
        ? "needs_review"
        : h.job_state === "failed"
          ? "failed"
          : "in_progress";
  return { status, code: h.error_code, ref: h.provider_ref, target: h.target };
}

async function safeSetTarget(d: JobStore, id: string, token: string, target: string) {
  try {
    return await d.setTarget(id, token, target);
  } catch {
    return false;
  }
}

/** Persist the outcome; if it isn't confirmed saved (lock lost / write failed), report needs_review, never done. */
async function finish(
  d: Pick<JobStore, "transition">,
  id: string,
  token: string | null,
  to: "succeeded" | "failed" | "uncertain",
  ref: string,
  code: string,
  target: string,
): Promise<StepResult> {
  let saved = false;
  try {
    saved = (await d.transition(id, token, to, ref, code)) === true;
  } catch {
    saved = false;
  }
  if (!saved) return { status: "needs_review", code: "not_saved", ref: "", target };
  return {
    status: to === "succeeded" ? "done" : to === "failed" ? "failed" : "needs_review",
    code,
    ref,
    target,
  };
}

export type Candidate = { number: string; region: string; locality: string };

/** Same area code first; otherwise a provider-verified nearby number in the salon's state. Never an unrelated area. */
export function pickTemporaryNumber(
  business: string,
  byArea: Candidate[],
  nearby: Candidate[],
  addressState: string | null,
  preferredArea?: string,
): { candidate: Candidate; reason: "same_area_code" | "nearby" } | null {
  const area = preferredArea || areaCodeOf(business);
  if (!/^[2-9][0-9]{2}$/.test(area)) return null;
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
  d: PurchaseDeps,
  input: { key: string; businessNumber: string; addressState: string | null; areaCode?: string | undefined },
): Promise<StepResult> {
  const h = await d.begin(input.key);
  if (!h.acquired || !h.lock_token) return fromExisting(h);
  const token = h.lock_token;
  const done = (
    to: "succeeded" | "failed" | "uncertain",
    ref: string,
    code: string,
    target: string,
  ) => finish(d, h.job_id, token, to, ref, code, target);

  // Searching is read-only, so a failure here is safe to report as a clean failure.
  let pick: ReturnType<typeof pickTemporaryNumber> = null;
  try {
    const byArea = await d.searchByArea(input.areaCode || areaCodeOf(input.businessNumber));
    pick = pickTemporaryNumber(
      input.businessNumber,
      byArea,
      [],
      input.addressState,
      input.areaCode,
    );
    if (!pick && input.businessNumber)
      pick = pickTemporaryNumber(
        input.businessNumber,
        [],
        await d.searchNearby(input.businessNumber),
        input.addressState,
      );
  } catch {
    return done("failed", "", "search_failed", "");
  }
  if (!pick) return done("failed", "", "no_local_numbers", "");

  const number = pick.candidate.number;
  // Persist the exact number before buying so an unclear result can be reconciled later.
  if (!(await safeSetTarget(d, h.job_id, token, number)))
    return { status: "needs_review", code: "lock_lost", ref: "", target: "" };

  let out: Outcome<{ sid: string }>;
  try {
    out = await d.buy(number);
  } catch {
    out = { kind: "ambiguous", code: "unconfirmed" };
  }
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
  if (!(await safeSetTarget(d, h.job_id, token, marker)))
    return { status: "needs_review", code: "lock_lost", ref: "", target: "" };
  let out: Outcome<{ agentId: string }>;
  try {
    out = await d.create(marker);
  } catch {
    out = { kind: "ambiguous", code: "unconfirmed" };
  }
  if (out.kind === "ok")
    return finish(d, h.job_id, token, "succeeded", out.value.agentId, "", marker);
  if (out.kind === "rejected") return finish(d, h.job_id, token, "failed", "", out.code, marker);
  return finish(d, h.job_id, token, "uncertain", "", "unconfirmed", marker);
}

/**
 * Resolve an uncertain job by looking (read-only) at the provider. Never repeats the create/purchase.
 * Absence from a provider listing is NOT proof (eventual consistency), so a target-bearing job stays
 * uncertain; only a found resource, or explicit admin resolution elsewhere, closes it.
 */
export async function reconcile(
  transition: JobStore["transition"],
  job: { id: string; target: string },
  lookup: (target: string) => Promise<Outcome<string | null>>,
  notFoundCode: string,
): Promise<StepResult> {
  if (!job.target) {
    // The target is recorded before any provider call, so none was made: definitive.
    return finish({ transition }, job.id, null, "failed", "", notFoundCode, "");
  }
  let r: Outcome<string | null>;
  try {
    r = await lookup(job.target);
  } catch {
    r = { kind: "ambiguous", code: "check_failed" };
  }
  if (r.kind !== "ok")
    return { status: "needs_review", code: "check_failed", ref: "", target: job.target };
  if (typeof r.value === "string" && r.value)
    return finish({ transition }, job.id, null, "succeeded", r.value, "", job.target);
  return { status: "needs_review", code: "not_found_yet", ref: "", target: job.target };
}
