import { type ReactNode } from "react";
import { days, type DayHours } from "@/lib/setup-model";

export const inputClass = "h-11 w-full min-w-0 rounded-xl border border-border bg-background/70 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
export const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block min-w-0"><span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>{children}{hint && <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{hint}</span>}</label>;
}
export function Heading({ title, description }: { title: string; description: string }) {
  return <div className="mb-8"><h2 tabIndex={-1} id="setup-heading" className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl">{title}</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p></div>;
}
export function HoursEditor({ value, onChange, title = "Business hours" }: { value: DayHours[]; onChange: (v: DayHours[]) => void; title?: string }) {
  return <fieldset className="mt-6 rounded-2xl border border-border p-4 sm:p-5"><legend className="px-2 text-sm font-medium">{title}</legend>
    <p className="mb-4 text-xs text-muted-foreground">Times use your business time zone. Overnight hours are not supported yet.</p>
    <div className="space-y-3">{days.map((day, i) => <div key={day} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[112px_1fr_1fr_auto]">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value[i]!.open} onChange={e => onChange(value.map((d,j) => j===i ? {...d,open:e.target.checked}:d))}/>{day.slice(0,3)}</label>
      <span className="text-right text-xs text-muted-foreground sm:hidden">{value[i]!.open ? "Open" : "Closed"}</span>
      <input aria-label={`${title}: ${day} opening time`} type="time" disabled={!value[i]!.open} className={inputClass} value={value[i]!.start} onChange={e => onChange(value.map((d,j) => j===i ? {...d,start:e.target.value}:d))}/>
      <input aria-label={`${title}: ${day} closing time`} type="time" disabled={!value[i]!.open} className={inputClass} value={value[i]!.end} onChange={e => onChange(value.map((d,j) => j===i ? {...d,end:e.target.value}:d))}/>
      <button type="button" className="col-span-2 min-h-8 text-left text-xs text-muted-foreground hover:text-foreground sm:col-span-1" onClick={() => onChange(value.map(() => ({...value[i]!})))} aria-label={`Copy ${day} hours to all days`}>Copy to all</button>
    </div>)}</div>
  </fieldset>;
}
