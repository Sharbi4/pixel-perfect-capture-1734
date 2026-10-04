import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPages";
import { legalDocuments } from "@/lib/legal-content";
import { pageMeta } from "@/components/site/SiteShell";
const doc=legalDocuments.find(d=>d.slug==="messaging-policy")!;
export const Route=createFileRoute("/messaging-policy")({head:()=>pageMeta(doc.title,doc.summary),component:()=> <LegalPage slug="messaging-policy"/>});
