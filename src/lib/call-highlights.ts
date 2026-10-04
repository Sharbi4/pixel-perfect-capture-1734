// Picks out notable moments from a transcript with simple, transparent keyword rules.
export type Line = { role: "agent" | "customer"; text: string; t: number };
export type Kind = "booking" | "deposit" | "price" | "transfer" | "human" | "complaint" | "cancel" | "reschedule";
export type Highlight = { kind: Kind; label: string; t: number; text: string };

const RULES: { kind: Kind; label: string; re: RegExp; role?: Line["role"] }[] = [
  { kind: "booking", label: "Appointment booked", re: /\b(you'?re (all )?booked|i'?ve booked|booked you|scheduled you|appointment is (set|confirmed)|see you (on|at))\b/i, role: "agent" },
  { kind: "deposit", label: "Deposit requested", re: /\bdeposit\b/i, role: "agent" },
  { kind: "price", label: "Price quoted", re: /\$\s?\d+|\b\d+\s?dollars\b/i, role: "agent" },
  { kind: "transfer", label: "Transfer attempted", re: /\b(transfer(ring)? you|connect you|put you through)\b/i, role: "agent" },
  { kind: "human", label: "Asked for a person", re: /\b(real person|human|speak (to|with) (someone|a person|the owner|a manager|staff)|talk to (someone|a person|the owner|a manager))\b/i, role: "customer" },
  { kind: "complaint", label: "Complaint detected", re: /\b(complain|refund|unhappy|disappointed|upset|terrible|awful|rude)\b/i, role: "customer" },
  { kind: "reschedule", label: "Reschedule", re: /\b(reschedul|move my appointment|change my appointment|different (day|time))/i },
  { kind: "cancel", label: "Cancellation", re: /\bcancel/i, role: "customer" },
];

export function highlights(lines: Line[]): Highlight[] {
  const out: Highlight[] = [];
  const seen = new Set<Kind>();
  for (const l of lines) for (const r of RULES) {
    if (r.role && r.role !== l.role) continue;
    if (seen.has(r.kind) || !r.re.test(l.text)) continue;
    seen.add(r.kind);
    out.push({ kind: r.kind, label: r.label, t: l.t, text: l.text });
  }
  return out.sort((a, b) => a.t - b.t);
}
