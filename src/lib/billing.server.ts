/** Authoritative access is backend-owned and must be set by verified payment processing. */
export function requirePaidAccess(salon: { paid_access_until?: string | null } | null) {
  if (!salon?.paid_access_until || Date.parse(salon.paid_access_until) <= Date.now() || !Number.isFinite(Date.parse(salon.paid_access_until))) {
    throw new Error("Complete checkout before creating your receptionist, importing a menu or reserving a number.");
  }
}
