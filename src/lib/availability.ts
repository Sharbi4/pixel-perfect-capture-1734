// Pure scheduling math, shared by the dashboard, the voice agent tools and the text agent.

export type Hours = Record<string, [number, number][]>; // weekday "0"(Sun)-"6" -> [startMin, endMin] ranges
export type StaffLite = { id: string; name: string; service_ids: string[]; hours: Hours; active: boolean };
export type Busy = { staff_id: string | null; starts_at: string; ends_at: string };
export type Rules = { timezone: string; buffer_min: number; lead_min: number; horizon_days: number };
export type Slot = { staff_id: string; staff_name: string; start: string; end: string };

/** Offset (ms) of the time zone at a given UTC instant. */
function tzOffset(tz: string, at: Date): number {
  const p: Record<string, number> = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p["year"]!, p["month"]! - 1, p["day"]!, p["hour"]!, p["minute"]!, p["second"]!) - at.getTime();
}

/** Wall-clock date + minutes in the salon's zone -> UTC instant. */
export function zoned(date: string, minutes: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - tzOffset(tz, new Date(guess));
  return new Date(guess - tzOffset(tz, new Date(first)));
}

/** UTC instant -> "YYYY-MM-DD" in the salon's zone. */
export function localDate(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Open start times for one day. A slot is open when the whole service plus buffer fits inside
 * working hours and doesn't touch another booking or time off.
 */
export function openSlots(o: {
  date: string; staff: StaffLite[]; busy: Busy[]; minutes: number; rules: Rules; now: Date;
  serviceId?: string | null | undefined; staffId?: string | null | undefined; step?: number;
}): Slot[] {
  const step = o.step ?? 15;
  const { timezone: tz, buffer_min: buf } = o.rules;
  const earliest = o.now.getTime() + o.rules.lead_min * 60_000;
  const latest = o.now.getTime() + o.rules.horizon_days * 86_400_000;
  const out: Slot[] = [];
  for (const s of o.staff) {
    if (!s.active || (o.staffId && s.id !== o.staffId)) continue;
    if (o.serviceId && s.service_ids.length && !s.service_ids.includes(o.serviceId)) continue;
    const ranges = s.hours[String(weekday(o.date))] ?? [];
    const mine = o.busy.filter((b) => b.staff_id === s.id).map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)] as const);
    for (const [from, to] of ranges) {
      for (let m = from; m + o.minutes <= to; m += step) {
        const start = zoned(o.date, m, tz).getTime();
        const end = start + o.minutes * 60_000;
        if (start < earliest || start > latest) continue;
        const clash = mine.some(([bs, be]) => start < be + buf * 60_000 && end + buf * 60_000 > bs);
        if (!clash) out.push({ staff_id: s.id, staff_name: s.name, start: new Date(start).toISOString(), end: new Date(end).toISOString() });
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export function fmtTime(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}
export function fmtDay(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
}
