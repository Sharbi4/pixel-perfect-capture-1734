import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "@/components/site/PublicPages";
import { pageMeta } from "@/components/site/SiteShell";
export const Route = createFileRoute("/features")({ head:()=>pageMeta("Features","Explore the Salon Pro Agent receptionist, conversations, scheduling and service knowledge."), component: FeaturesPage });
