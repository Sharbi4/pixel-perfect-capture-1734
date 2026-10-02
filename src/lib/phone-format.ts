// Client-safe US phone helpers.

/** Normalize a US (NANP) number to E.164 (+1XXXXXXXXXX), or null if invalid. */
export function normalizeUsNumber(input: string): string | null {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return null;
  // NANP: area code and exchange cannot start with 0 or 1; N11 area codes are service codes.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
  if (d[1] === "1" && d[2] === "1") return null;
  return `+1${d}`;
}

export function formatUsNumber(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 ?? "");
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function areaCodeOf(e164: string): string {
  return /^\+1\d{10}$/.test(e164) ? e164.slice(2, 5) : "";
}

const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "),
);

/** Best-effort 2-letter state from a free-text US address ("..., Phoenix, AZ 85004"). */
export function stateFromAddress(address: string): string | null {
  const m = /\b([A-Z]{2})\s*,?\s*\d{5}(?:-\d{4})?\b/.exec((address ?? "").toUpperCase());
  return m && STATES.has(m[1]) ? m[1] : null;
}
