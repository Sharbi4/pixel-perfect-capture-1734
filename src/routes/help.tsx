import { createFileRoute } from "@tanstack/react-router";
import { HelpPage } from "@/components/site/PublicPages";
import { pageMeta } from "@/components/site/SiteShell";
export const Route = createFileRoute("/help")({ head:()=>pageMeta("Help center","Guides to salon setup, calls, messages, billing and your AI receptionist."), component: HelpPage });
