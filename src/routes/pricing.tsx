import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/site/PublicPages";
import { pageMeta } from "@/components/site/SiteShell";
export const Route = createFileRoute("/pricing")({ head:()=>pageMeta("Plans & pricing","Compare Essential, Pro and Premier with included voice minutes, SMS and salon locations."), component: PricingPage });
