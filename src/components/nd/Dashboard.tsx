import { CalendarDays, MessageSquare, Phone, TrendingUp } from "lucide-react";
import { BrandMark } from "@/components/brand/Brand";

const metrics = [
  { label: "Appointments booked", value: "127", delta: "+18%", icon: CalendarDays },
  { label: "Calls answered", value: "286", delta: "+9%", icon: Phone },
  { label: "Texts handled", value: "419", delta: "+24%", icon: MessageSquare },
  { label: "Est. revenue captured", value: "$8,420", delta: "+31%", icon: TrendingUp },
];
const tabs = ["Inbox", "Calls", "Appointments", "Customers", "AI Receptionist", "Analytics"];
const convos = [
  { n: "Jessica R.", c: "Call", m: "Booked gel manicure · 4:15 PM with Mia", t: "2m" },
  { n: "Hannah P.", c: "Text", m: "Rescheduled to Saturday 11:00 AM", t: "9m" },
  { n: "Ngọc T.", c: "Call · VI", m: "Asked about dip powder pricing", t: "14m" },
  { n: "Brianna L.", c: "Text", m: "Booked pedicure · tomorrow 4:15 PM", t: "22m" },
  { n: "Unknown", c: "Call", m: "Transferred to front desk — gift card issue", t: "31m" },
];
const bars = [38, 52, 44, 61, 58, 72, 86];
const days = ["M", "T", "W", "T", "F", "S", "S"];
const today = [
  ["10:00", "Gel manicure", "Mia"],
  ["11:30", "Acrylic full set", "Kim"],
  ["1:00", "Spa pedicure", "Lisa"],
  ["2:15", "Dip powder", "Amy"],
  ["4:15", "Gel manicure", "Mia"],
];

export function Dashboard() {
  return (
    <div className="glass overflow-hidden rounded-[28px] shadow-glow">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-surface-2" />)}
        </div>
        <div className="mx-auto flex min-w-0 items-center gap-2 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
          <BrandMark className="size-5" />
          <span className="truncate">Salon Pro Agent <span className="opacity-50">/</span> Luna Nails</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 text-[13px]">
        {tabs.map((t, i) => (
          <span key={t} className={`rounded-full px-3 py-1.5 whitespace-nowrap ${i === 0 ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{t}</span>
        ))}
      </div>
      <div className="grid gap-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(({ label, value, delta, icon: I }) => (
            <div key={label} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs">{label}</span>
                <I className="size-3.5" />
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{value}</div>
              <div className="mt-1 text-xs text-success">{delta} vs last month</div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Recent conversations</span>
              <span className="text-xs text-muted-foreground">Handled by Salon Pro Agent</span>
            </div>
            <div className="divide-y divide-border">
              {convos.map((c) => (
                <div key={c.n + c.t} className="flex items-center gap-3 py-2.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-medium">{c.n[0]}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{c.n}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{c.c}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{c.m}</div>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{c.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-sm font-medium">Bookings this week</div>
              <div className="mt-4 flex h-28 items-end gap-2">
                {bars.map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className={`w-full rounded-md ${i === 6 ? "bg-brand" : "bg-surface-2"}`} style={{ height: `${h}%` }} />
                    <span className="text-[10px] text-muted-foreground">{days[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-2 text-sm font-medium">Today's calendar</div>
              {today.map(([t, s, n]) => (
                <div key={t} className="flex items-center gap-3 py-1.5 text-xs">
                  <span className="w-10 font-mono text-muted-foreground">{t}</span>
                  <span className="h-4 w-0.5 rounded bg-violet" />
                  <span className="flex-1">{s}</span>
                  <span className="text-muted-foreground">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
