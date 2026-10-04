import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPages";
import { legalDocuments } from "@/lib/legal-content";
import { pageMeta } from "@/components/site/SiteShell";
const doc=legalDocuments.find(d=>d.slug==="cancellation-refunds")!;
export const Route=createFileRoute("/cancellation-refunds")({head:()=>pageMeta(doc.title,doc.summary),component:()=> <LegalPage slug="cancellation-refunds"/>});
