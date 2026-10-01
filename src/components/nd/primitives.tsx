import { cva, type VariantProps } from "class-variance-authority";
import { useEffect, useRef, type ReactNode, type AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const ndButton = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:shadow-glow hover:-translate-y-px",
        brand: "bg-brand text-primary-foreground shadow-glow hover:brightness-110 hover:-translate-y-px",
        ghost: "glass text-foreground hover:bg-accent",
        link: "text-muted-foreground hover:text-foreground",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function NdButton({
  variant,
  size,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof ndButton>) {
  return <a className={cn(ndButton({ variant, size }), className)} {...props} />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
      <span className="bg-brand size-1.5 rounded-full" />
      {children}
    </span>
  );
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function SectionHead({ eyebrow, title, body }: { eyebrow?: string; title: ReactNode; body?: ReactNode }) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-5 text-4xl font-semibold tracking-[-0.035em] text-balance md:text-6xl">{title}</h2>
      {body && <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">{body}</p>}
    </Reveal>
  );
}

export function Waveform({ bars = 24, className }: { bars?: number; className?: string }) {
  return (
    <div className={cn("flex h-8 items-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="wave-bar bg-brand h-full w-[3px] rounded-full"
          style={{ animationDelay: `${(i * 73) % 900}ms`, animationDuration: `${800 + ((i * 131) % 600)}ms` }}
        />
      ))}
    </div>
  );
}

export function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="bg-brand grid size-7 place-items-center rounded-lg shadow-glow">
        <span className="size-2.5 rounded-sm bg-primary" />
      </span>
      <span>
        NailDesk <span className="text-muted-foreground">AI</span>
      </span>
    </a>
  );
}

/** Loops a step counter 0..total-1 */
export function useStepLoop(durations: number[]) {
  // implemented in caller via useState; helper kept simple
  return durations;
}
