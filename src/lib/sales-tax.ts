// Combined state + average local sales tax rates (percent), by US state code.
// Applied at checkout to the setup fee and every monthly charge.
export const SALES_TAX_RATES: Record<string, number> = {
  AL: 9.46, AK: 1.82, AZ: 8.52, AR: 9.46, CA: 8.99, CO: 7.89, CT: 6.35, DE: 0,
  FL: 6.98, GA: 7.49, HI: 4.5, ID: 6.03, IL: 8.96, IN: 7.0, IA: 6.94, KS: 8.69,
  KY: 6.0, LA: 10.11, ME: 5.5, MD: 6.0, MA: 6.25, MI: 6.0, MN: 8.14, MS: 7.06,
  MO: 8.44, MT: 0, NE: 6.98, NV: 8.24, NH: 0, NJ: 6.6, NM: 7.67, NY: 8.54,
  NC: 7.0, ND: 7.09, OH: 7.29, OK: 9.06, OR: 0, PA: 6.34, RI: 7.0, SC: 7.49,
  SD: 6.11, TN: 9.61, TX: 8.2, UT: 7.42, VT: 6.39, VA: 5.77, WA: 9.51, WV: 6.59,
  WI: 5.72, WY: 5.56, DC: 6.0,
};

export function taxRate(state: string | null | undefined): number | null {
  const r = SALES_TAX_RATES[(state ?? "").trim().toUpperCase()];
  return r === undefined ? null : r;
}

export function isTaxState(state: string | null | undefined) {
  return taxRate(state) !== null;
}

/** Tax in cents on an amount in cents, rounded half-up to the cent. */
export function taxCents(amountCents: number, state: string | null | undefined): number {
  const r = taxRate(state) ?? 0;
  return Math.round((amountCents * r) / 100);
}

/** Today's charge: setup + first month, each taxed. */
export function checkoutTotals(setupCents: number, monthlyCents: number, state?: string | null) {
  const setupTax = taxCents(setupCents, state),
    monthlyTax = taxCents(monthlyCents, state);
  return {
    setupTax,
    monthlyTax,
    taxCents: setupTax + monthlyTax,
    todayCents: setupCents + monthlyCents + setupTax + monthlyTax,
    recurringCents: monthlyCents + monthlyTax,
    rate: taxRate(state) ?? 0,
  };
}
