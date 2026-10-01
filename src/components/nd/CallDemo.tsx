import { Check, Phone } from "lucide-react";
import { Waveform } from "./primitives";
import { useSequence } from "./useSequence";

const DELAYS = [1200, 1800, 2000, 1500, 1600, 1200, 1400];

function Bubble({ who, children }: { who: "ai" | "you"; children: React.ReactNode }) {
  return (
    <div className={`animate-rise flex ${who === "you" ? "justify-end" : ""}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug ${
          who === "ai" ? "glass rounded-tl-md" : "bg-surface-2 rounded-tr-md"
        }`}
      >
        <div className="mb-0.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          {who === "ai" ? "NailDesk" : "Jessica"}
        </div>
        {children}
      </div>
    </div>
  );
}

export function CallDemo() {
  const s = useSequence(DELAYS);
  const state = s === 0 ? "Ringing" : s === 2 || s === 4 ? "Listening" : s === 3 ? "Checking availability" : s >= 6 ? "Booked" : "Speaking";

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <div className="bg-brand absolute -inset-6 rounded-[48px] opacity-30 blur-3xl" />
      <div className="glass relative rounded-[36px] p-2.5 shadow-glow">
        <div className="rounded-[28px] bg-background/80 p-5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono">Luna Nails · Line 1</span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success pulse-ring" /> Live
            </span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="bg-brand grid size-11 place-items-center rounded-full">
              <Phone className="size-4.5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] text-muted-foreground">Incoming call</div>
              <div className="font-semibold">Jessica R.</div>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{s === 0 ? "--:--" : `0:${String(s * 4).padStart(2, "0")}`}</span>
          </div>

          <div className="glass mt-4 flex items-center justify-between rounded-2xl px-4 py-2.5">
            <Waveform bars={22} className={s >= 6 ? "opacity-30" : ""} />
            <span className="text-[11px] font-medium text-muted-foreground">
              {state}
              {(state === "Listening" || state.startsWith("Checking")) && (
                <span>
                  <span className="dot">.</span>
                  <span className="dot [animation-delay:150ms]">.</span>
                  <span className="dot [animation-delay:300ms]">.</span>
                </span>
              )}
            </span>
          </div>

          <div className="mt-4 flex min-h-[300px] flex-col gap-2.5">
            {s >= 1 && <Bubble who="ai">Thanks for calling Luna Nails. How can I help you?</Bubble>}
            {s >= 2 && <Bubble who="you">Do you have anything for a gel manicure around 4?</Bubble>}
            {s >= 3 && <Bubble who="ai">I can check that for you.</Bubble>}
            {s >= 4 && (
              <div className="animate-rise rounded-2xl border border-border bg-surface p-3">
                <div className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Today · Gel manicure</div>
                {[
                  ["4:15 PM", "Mia"],
                  ["4:45 PM", "Kim"],
                ].map(([t, n], i) => (
                  <div
                    key={t}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                      s >= 5 && i === 0 ? "bg-accent ring-1 ring-violet" : ""
                    }`}
                  >
                    <span className="font-mono">{t}</span>
                    <span className="text-muted-foreground">{n}</span>
                  </div>
                ))}
              </div>
            )}
            {s >= 6 && (
              <div className="animate-rise flex items-center gap-2.5 rounded-2xl bg-success/12 px-4 py-3 text-sm font-medium text-success ring-1 ring-success/30">
                <Check className="size-4" /> Appointment booked · 4:15 PM with Mia
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
