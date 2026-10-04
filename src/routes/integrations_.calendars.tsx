import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsPage } from "@/components/site/PublicPages";
import { pageMeta } from "@/components/site/SiteShell";
export const Route = createFileRoute("/integrations_/calendars")({ head:()=>pageMeta("Calendar integrations","Native scheduling and our roadmap for Square Appointments and other calendars."), component: ()=> <IntegrationsPage calendars/> });
