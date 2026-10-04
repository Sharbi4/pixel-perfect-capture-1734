// Picks out notable moments from a transcript with simple, transparent keyword rules.
export type Line = { role: "agent" | "customer"; text: string; t: number };
export type Highlight = { kind: "price" | "booking" | "transfer" | "cancel" | "complaint"; label: string; t: number; text: string };

const RULES: { kind: Highlight["kind"]; label: string; re: RegExp; role?: Line["role"] }[] = [
  { kind: "price", label: "Price quoted", re: /\$\s?\d+|\b\d+\s?dollars\b/i, role: "agent" },
  { kind: "booking", label: "Booking", re: /\b(booked|book you|scheduled|appointment (is|for)|see you (on|at))\b/i, role: "agent" },
  { kind: "transfer", label: "Transfer", re: /\b(transfer|connect you|put you through|speak (to|with) (a|the) (person|manager|human|someone))\b/i },
  { kind: "cancel", label: "Cancel / reschedule", re: /\b(cancel|reschedul)/i },
  { kind: "complaint", label: "Unhappy client", re: /\b(complain|refund|unhappy|disappointed|upset|terrible)\b/i, role: "customer" },
];

export function highlights(lines: Line[]): Highlight[] {
  const out: Highlight[] = [];
  const seen = new Set<string>();
  for (const l of lines) for (const r of RULES) {
    if (r.role && r.role !== l.role) continue;
    if (!r.re.test(l.text) || seen.has(r.kind)) continue;
    seen.add(r.kind);
    out.push({ kind: r.kind, label: r.label, t: l.t, text: l.text });
  }
  return out.sort((a, b) => a.t - b.t);
}
