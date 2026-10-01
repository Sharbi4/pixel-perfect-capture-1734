import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

const BASE = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export type ExtractedService = { name: string; price: number; minutes: number; is_addon: boolean };

const INSTRUCTIONS = `You turn nail salon menus into structured data.
Return ONLY a JSON array, no prose, no code fences. Each item: {"name": string, "price": number (USD, 0 if unknown), "minutes": integer (estimate a typical nail-salon duration if missing), "is_addon": boolean}.
Include every service and add-on you can find. Max 60 items.`;

export async function extractServicesWithAI(parts: ModelMessage["content"]): Promise<ExtractedService[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: BASE,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      if (!res.ok) {
        const msg = await res.clone().text().catch(() => "");
        console.error("AI gateway error", res.status, msg.slice(0, 300));
        if (res.status === 402) throw new Error("AI credits have run out. Add credits to keep importing menus.");
        if (res.status === 429) throw new Error("Too many requests right now. Please try again in a minute.");
      }
      return res;
    },
  });
  const result = streamText({
    model: provider.responses(MODEL),
    system: INSTRUCTIONS,
    messages: [{ role: "user", content: parts } as ModelMessage],
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("We couldn't find any services in that menu.");
  const raw = JSON.parse(match[0]) as Partial<ExtractedService>[];
  return raw
    .filter((s) => s && typeof s.name === "string" && s.name.trim())
    .slice(0, 60)
    .map((s) => ({
      name: String(s.name).trim().slice(0, 120),
      price: Number(s.price) || 0,
      minutes: Math.max(5, Math.round(Number(s.minutes) || 30)),
      is_addon: Boolean(s.is_addon),
    }));
}
