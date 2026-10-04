import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPages";
import { legalDocuments } from "@/lib/legal-content";
import { pageMeta } from "@/components/site/SiteShell";
const doc=legalDocuments.find(d=>d.slug==="ai-call-policy")!;
export const Route=createFileRoute("/ai-call-policy")({head:()=>pageMeta(doc.title,doc.summary),component:()=> <LegalPage slug="ai-call-policy"/>});
