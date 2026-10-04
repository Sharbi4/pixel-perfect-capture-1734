// Compares an uploaded menu with the live one. Pure, so it can be reviewed before anything is written.
export type LiveSvc = { id: string; name: string; price: number; minutes: number; is_addon: boolean; archived: boolean };
export type NewSvc = { name: string; price: number; minutes: number; is_addon: boolean };
export type Change =
  | { kind: "add"; key: string; next: NewSvc }
  | { kind: "update"; key: string; id: string; prev: LiveSvc; next: NewSvc; price: boolean; minutes: boolean; addon: boolean; restore: boolean }
  | { kind: "remove"; key: string; prev: LiveSvc };

export const normName = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").replace(/\b(the|a|an)\b/g, "").replace(/\s+/g, " ").trim();

export function diffMenu(live: LiveSvc[], incoming: NewSvc[]): Change[] {
  const byName = new Map(live.map((s) => [normName(s.name), s]));
  const seen = new Set<string>();
  const out: Change[] = [];
  for (const n of incoming) {
    const k = normName(n.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const p = byName.get(k);
    if (!p) { out.push({ kind: "add", key: `add:${k}`, next: n }); continue; }
    const price = Math.abs(Number(p.price) - n.price) > 0.001, minutes = p.minutes !== n.minutes, addon = p.is_addon !== n.is_addon;
    if (price || minutes || addon || p.archived) out.push({ kind: "update", key: `upd:${p.id}`, id: p.id, prev: p, next: n, price, minutes, addon, restore: p.archived });
  }
  for (const p of live) if (!p.archived && !seen.has(normName(p.name))) out.push({ kind: "remove", key: `rm:${p.id}`, prev: p });
  return out;
}

export function summarize(c: Change[]) {
  const n = { add: 0, price: 0, other: 0, remove: 0 };
  for (const x of c) {
    if (x.kind === "add") n.add++;
    else if (x.kind === "remove") n.remove++;
    else if (x.price) n.price++;
    else n.other++;
  }
  return n;
}
