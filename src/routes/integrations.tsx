import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsPage } from "@/components/site/PublicPages";
import { pageMeta } from "@/components/site/SiteShell";
export const Route = createFileRoute("/integrations")({ head:()=>pageMeta("Integrations","See current and planned Salon Pro Agent integrations."), component: IntegrationsPage });
