import { createFileRoute } from "@tanstack/react-router";
import { LegalHub } from "@/components/site/LegalPages";
import { pageMeta } from "@/components/site/SiteShell";
export const Route=createFileRoute("/legal")({head:()=>pageMeta("Legal & trust","Salon Pro Agent LLC policies for service, privacy, messaging and billing."),component:LegalHub});
