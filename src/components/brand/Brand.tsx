import { cn } from "@/lib/utils";

type LogoVariant = "dark" | "light" | "white" | "black";

/** Supplied outlined wordmark: no font substitution or CSS recoloring. */
export function BrandLogo({ variant = "dark", className, href = "/" }: {
  variant?: LogoVariant;
  className?: string;
  href?: string;
}) {
  return (
    <a href={href} aria-label="Salon Agent home" className={cn(
      "inline-flex w-[200px] shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:w-[210px]", className,
    )}>
      <img src={`/brand/logo-${variant}.svg`} alt="Salon Agent" width={602} height={120} className="block h-auto w-full" decoding="async" />
    </a>
  );
}

/** Agent identity; functional call and microphone icons retain their meaning. */
export function BrandMark({ variant = "gradient", className, decorative = true }: {
  variant?: "gradient" | "white" | "black";
  className?: string;
  decorative?: boolean;
}) {
  return <img src={`/brand/mark-${variant}.svg`} width={100} height={100} alt={decorative ? "" : "Salon Agent"} aria-hidden={decorative || undefined} className={cn("block size-8 shrink-0", className)} decoding="async" />;
}
