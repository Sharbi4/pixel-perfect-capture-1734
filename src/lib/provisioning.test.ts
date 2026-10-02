import { describe, expect, it, vi } from "vitest";
import {
  classifyHttp, pickTemporaryNumber, reconcile, runAgentCreate, runPurchase,
  type JobHandle, type Outcome, type PurchaseDeps,
} from "./provisioning";
import { areaCodeOf, normalizeUsNumber, stateFromAddress } from "./phone-format";

/** In-memory model of the DB job rules (one active job per salon+kind, key idempotency, token-guarded transitions). */
function memoryStore() {
  type J = { id: string; key: string; state: string; token: string | null; target: string; ref: string; code: string };
  const jobs: J[] = [];
  let n = 0;
  const handle = (j: J, acquired: boolean): JobHandle => ({
    job_id: j.id, acquired, job_state: j.state, lock_token: acquired ? j.token : null, target: j.target, provider_ref: j.ref, error_code: j.code,
  });
  return {
    jobs,
    async begin(key: string) {
      let j = jobs.find((x) => x.key === key) ?? jobs.find((x) => ["pending", "in_progress", "uncertain"].includes(x.state));
      if (!j) { j = { id: `job-${++n}`, key, state: "pending", token: null, target: "", ref: "", code: "" }; jobs.push(j); }
      if (j.state === "pending") { j.state = "in_progress"; j.token = `tok-${n}`; return handle(j, true); }
      return handle(j, false);
    },
    async setTarget(id: string, token: string, target: string) {
      const j = jobs.find((x) => x.id === id && x.token === token && x.state === "in_progress");
      if (j) j.target = target;
      return !!j;
    },
    async transition(id: string, token: string | null, to: "succeeded" | "failed" | "uncertain", ref: string, code: string) {
      const j = jobs.find((x) => x.id === id && (token ? x.token === token && x.state === "in_progress" : x.state === "uncertain"));
      if (!j || (!token && to === "uncertain")) return false;
      Object.assign(j, { state: to, ref: ref || j.ref, code, token: null });
      return true;
    },
  };
}

const BUSINESS = "+14805550123";
const local = (num: string, region = "AZ") => ({ number: num, region, locality: "Phoenix" });

function purchaseDeps(buy: PurchaseDeps["buy"], byArea = [local("+14805550999")], nearby: ReturnType<typeof local>[] = []) {
  const store = memoryStore();
  const deps = { ...store, searchByArea: vi.fn(async () => byArea), searchNearby: vi.fn(async () => nearby), buy: vi.fn(buy) };
  return { store, deps };
}

describe("phone formatting", () => {
  it("normalizes US numbers and rejects invalid ones", () => {
    expect(normalizeUsNumber("(480) 555-0123")).toBe(BUSINESS);
    expect(normalizeUsNumber("1-480-555-0123")).toBe(BUSINESS);
    expect(normalizeUsNumber("555-0123")).toBeNull();
    expect(normalizeUsNumber("(180) 555-0123")).toBeNull(); // area code can't start with 1
    expect(normalizeUsNumber("(411) 555-0123")).toBeNull(); // N11 service code
    expect(areaCodeOf(BUSINESS)).toBe("480");
    expect(stateFromAddress("12 Main St, Phoenix, AZ 85004")).toBe("AZ");
    expect(stateFromAddress("12 Main St")).toBeNull();
  });
});

describe("provider outcome classification", () => {
  it("only 2xx is success; 4xx is a clean refusal; timeouts and 5xx are unclear", () => {
    expect(classifyHttp(201)).toBe("ok");
    expect(classifyHttp(400)).toBe("rejected");
    expect(classifyHttp(429)).toBe("rejected");
    expect(classifyHttp(408)).toBe("ambiguous");
    expect(classifyHttp(502)).toBe("ambiguous");
  });
});

describe("temporary number selection", () => {
  it("prefers the business area code", () => {
    const r = pickTemporaryNumber(BUSINESS, [local("+16025550000"), local("+14805550999")], [], "AZ");
    expect(r?.candidate.number).toBe("+14805550999");
    expect(r?.reason).toBe("same_area_code");
  });
  it("falls back only to a nearby number in the salon's state, never an unrelated area", () => {
    expect(pickTemporaryNumber(BUSINESS, [local("+12125550000", "NY")], [], "AZ")).toBeNull();
    expect(pickTemporaryNumber(BUSINESS, [], [local("+17025550000", "NV")], "AZ")).toBeNull();
    expect(pickTemporaryNumber(BUSINESS, [], [local("+16235550000", "AZ")], "AZ")?.reason).toBe("nearby");
    expect(pickTemporaryNumber(BUSINESS, [], [local("+16235550000", "")], null)).toBeNull();
  });
});

describe("purchase job", () => {
  const input = { key: "k1", businessNumber: BUSINESS, addressState: "AZ" };

  it("buys once and records the number", async () => {
    const { deps, store } = purchaseDeps(async () => ({ kind: "ok", value: { sid: "PN1" } }));
    const r = await runPurchase(deps, input);
    expect(r).toMatchObject({ status: "done", target: "+14805550999", ref: "PN1" });
    expect(store.jobs[0]!).toMatchObject({ state: "succeeded", target: "+14805550999" });
  });

  it("concurrent requests (double click / two tabs) purchase only once", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { deps } = purchaseDeps(async () => { await gate; return { kind: "ok", value: { sid: "PN1" } }; });
    const a = runPurchase(deps, input);
    const b = runPurchase(deps, { ...input, key: "k2" }); // different key, same salon
    const c = runPurchase(deps, input); // same key
    await new Promise((r) => setTimeout(r, 0));
    release();
    const results = await Promise.all([a, b, c]);
    expect(deps.buy).toHaveBeenCalledTimes(1);
    expect(results.filter((x) => x.status === "done").length).toBe(1);
  });

  it("an unclear result is never retried automatically, even with a new key", async () => {
    const { deps, store } = purchaseDeps(async () => { throw new Error("socket hang up"); });
    expect((await runPurchase(deps, input)).status).toBe("needs_review");
    expect((await runPurchase(deps, input)).status).toBe("needs_review");
    expect((await runPurchase(deps, { ...input, key: "k-new" })).status).toBe("needs_review");
    expect(deps.buy).toHaveBeenCalledTimes(1);
    expect(store.jobs[0]!).toMatchObject({ state: "uncertain", target: "+14805550999" });
  });

  it("5xx after purchase is treated as unclear, not failed", async () => {
    const { deps } = purchaseDeps(async () => ({ kind: "ambiguous", code: "unconfirmed" }));
    expect((await runPurchase(deps, input)).status).toBe("needs_review");
  });

  it("a clean refusal fails and a new intentional action may try again", async () => {
    const outs: Outcome<{ sid: string }>[] = [{ kind: "rejected", code: "number_unavailable" }, { kind: "ok", value: { sid: "PN2" } }];
    const { deps } = purchaseDeps(async () => outs.shift()!);
    expect(await runPurchase(deps, input)).toMatchObject({ status: "failed", code: "number_unavailable" });
    expect((await runPurchase(deps, input)).status).toBe("failed"); // same key replays the result
    expect((await runPurchase(deps, { ...input, key: "k2" })).status).toBe("done");
    expect(deps.buy).toHaveBeenCalledTimes(2);
  });

  it("no local number means no purchase", async () => {
    const { deps } = purchaseDeps(async () => ({ kind: "ok", value: { sid: "X" } }), [local("+12125550000", "NY")], []);
    expect(await runPurchase(deps, input)).toMatchObject({ status: "failed", code: "no_local_numbers" });
    expect(deps.buy).not.toHaveBeenCalled();
  });
});

describe("reconciliation of unclear results", () => {
  async function uncertainJob() {
    const { deps, store } = purchaseDeps(async () => ({ kind: "ambiguous", code: "unconfirmed" }));
    await runPurchase(deps, { key: "k1", businessNumber: BUSINESS, addressState: "AZ" });
    return { store, job: { id: store.jobs[0]!.id, target: store.jobs[0]!.target } };
  }
  it("found at provider → succeeded with its real id", async () => {
    const { store, job } = await uncertainJob();
    const r = await reconcile(store.transition, job, async () => ({ kind: "ok", value: "PN9" }), "not_purchased");
    expect(r.status).toBe("done");
    expect(store.jobs[0]!).toMatchObject({ state: "succeeded", ref: "PN9" });
  });
  it("confirmed absent → failed, so the owner can try again", async () => {
    const { store, job } = await uncertainJob();
    expect((await reconcile(store.transition, job, async () => ({ kind: "ok", value: null }), "not_purchased")).status).toBe("failed");
    expect(store.jobs[0]!.state).toBe("failed");
  });
  it("lookup itself failing keeps it unclear", async () => {
    const { store, job } = await uncertainJob();
    const r = await reconcile(store.transition, job, async () => { throw new Error("down"); }, "not_purchased");
    expect(r.status).toBe("needs_review");
    expect(store.jobs[0]!.state).toBe("uncertain");
  });
});

describe("receptionist creation job", () => {
  it("parallel launches create one receptionist; unclear creates are not repeated", async () => {
    const store = memoryStore();
    const create = vi.fn(async (): Promise<Outcome<{ agentId: string }>> => ({ kind: "ambiguous", code: "unconfirmed" }));
    const [a, b] = await Promise.all([runAgentCreate({ ...store, create }, "a"), runAgentCreate({ ...store, create }, "b")]);
    expect(create).toHaveBeenCalledTimes(1);
    expect([a.status, b.status].sort()).toEqual(["in_progress", "needs_review"].sort());
    expect((await runAgentCreate({ ...store, create }, "c")).status).toBe("needs_review");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
