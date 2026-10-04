import { RefreshCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const dur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function Header({ title, sub, busy, onRefresh }: { title: string; sub: string; busy: boolean; onRefresh: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-muted-foreground">{sub}</p></div>
      <button onClick={onRefresh} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm disabled:opacity-60"><RefreshCw className={cn("size-4", busy && "animate-spin")} /> Check for new</button>
    </div>
  );
}
export function Empty({ icon: I, text }: { icon: LucideIcon; text: string }) {
  return <div className="grid place-items-center px-6 py-20 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-accent"><I className="size-5 text-violet" /></span><p className="mt-4 max-w-sm text-sm text-muted-foreground">{text}</p></div>;
}

