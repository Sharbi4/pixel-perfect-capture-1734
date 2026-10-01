import { CalendarCheck } from "lucide-react";
import { useSequence } from "./useSequence";

const DELAYS = [900, 1300, 2200, 1100, 1400, 1800];

const staff = ["Lisa", "Amy", "Tina"];
const hours = ["2 PM", "3 PM", "4 PM", "5 PM"];
const existing = [
  { staff: 0, start: 0, len: 1, label: "Gel mani" },
  { staff: 0, start: 2.2, len: 1, label: "Dip" },
  { staff: 1, start: 0.5, len: 1.2, label: "Acrylic fill" },
  { staff: 2, start: 1, len: 1.5, label: "Full set" },
];

function Msg({ me, children }: { me?: boolean; children: React.ReactNode }) {
  return (
    <div className={`animate-rise flex ${me ? "justify-end" : ""}`}>
      <div
        className={`max-w-[78%] rounded-[20px] px-4 py-2.5 text-[14px] leading-snug ${
          me ? "bg-cobalt text-foreground rounded-br-md" : "bg-surface-2 rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Typing({ me }: { me?: boolean }) {
  return (
    <div className={`flex ${me ? "justify-end" : ""}`}>
      <div className="flex gap-1 rounded-full bg-surface-2 px-4 py-3">
        {[0, 150, 300].map((d) => (
          <span key={d} className="dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function TextDemo() {
  const s = useSequence(DELAYS, 4000);
  const booked = s >= 6;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
      <div className="glass mx-auto w-full max-w-[380px] rounded-[32px] p-5">
        <div className="flex flex-col items-center border-b border-border pb-4">
          <div className="bg-brand grid size-10 place-items-center rounded-full text-sm font-semibold text-primary-foreground">LN</div>
          <div className="mt-1.5 text-sm font-medium">Luna Nails</div>
          <div className="text-[11px] text-muted-foreground">Text Message · Today</div>
        </div>
        <div className="mt-4 flex min-h-[330px] flex-col gap-2.5">
          {s >= 1 && <Msg me>Hi, can I get a pedicure tomorrow after 3?</Msg>}
          {s === 2 && <Typing />}
          {s >= 3 && <Msg>Absolutely ✨ I have 3:30 PM with Lisa or 4:15 PM with Amy. Which works better?</Msg>}
          {s >= 4 && <Msg me>4:15</Msg>}
          {s === 5 && <Typing />}
          {s >= 6 && <Msg>You're booked for tomorrow at 4:15 PM with Amy. I'll text you a reminder before your appointment.</Msg>}
        </div>
      </div>

      <div className="glass rounded-[28px] p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] tracking-wider text-muted-foreground uppercase">Tomorrow</div>
            <div className="font-semibold">Salon calendar</div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-500 ${
              booked ? "bg-success/12 text-success ring-1 ring-success/30" : "opacity-0"
            }`}
          >
            <CalendarCheck className="size-3.5" /> Appointment added
          </div>
        </div>
        <div className="mt-5 grid grid-cols-[48px_repeat(3,1fr)] gap-2 text-xs">
          <div />
          {staff.map((n) => (
            <div key={n} className="text-center font-medium text-muted-foreground">{n}</div>
          ))}
        </div>
        <div className="relative mt-2 grid grid-cols-[48px_repeat(3,1fr)] gap-2">
          <div className="flex flex-col">
            {hours.map((h) => (
              <div key={h} className="h-16 font-mono text-[10px] text-muted-foreground">{h}</div>
            ))}
          </div>
          {staff.map((_, si) => (
            <div key={si} className="relative h-64 rounded-xl border border-dashed border-border bg-muted">
              {existing
                .filter((e) => e.staff === si)
                .map((e) => (
                  <div
                    key={e.label}
                    className="absolute inset-x-1 rounded-lg bg-surface-2 px-2 py-1.5 text-[11px] text-muted-foreground"
                    style={{ top: e.start * 64 + 2, height: e.len * 64 - 4 }}
                  >
                    {e.label}
                  </div>
                ))}
              {si === 1 && booked && (
                <div
                  className="animate-rise bg-brand absolute inset-x-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-primary-foreground shadow-glow"
                  style={{ top: 2.25 * 64 + 2, height: 64 - 4 }}
                >
                  Pedicure · 4:15
                  <div className="font-normal opacity-80">via text</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
