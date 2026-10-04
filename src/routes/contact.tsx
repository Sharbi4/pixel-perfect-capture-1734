import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/site/PublicPages";
import { pageMeta } from "@/components/site/SiteShell";
export const Route = createFileRoute("/contact")({ head:()=>pageMeta("Contact us","Contact Salon Pro Agent LLC by phone or email for product and account support."), component: ContactPage });
