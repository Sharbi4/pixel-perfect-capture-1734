import { createFileRoute } from "@tanstack/react-router";
import { FAQPage } from "@/components/site/PublicPages";
import { pageMeta } from "@/components/site/SiteShell";
export const Route = createFileRoute("/faq")({ head:()=>pageMeta("Frequently asked questions","Answers about plans, phone numbers, texting, booking and privacy."), component: FAQPage });
