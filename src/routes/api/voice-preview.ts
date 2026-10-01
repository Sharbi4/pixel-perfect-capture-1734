import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { voices, greeting } from "@/lib/voices";

export const Route = createFileRoute("/api/voice-preview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return new Response("Please sign in", { status: 401 });
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return new Response("Please sign in", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { voice?: string; salon?: string };
        const v = voices.find((x) => x.id === body.voice) ?? voices[0];
        const salon = String(body.salon ?? "").slice(0, 80);
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Voice previews aren't configured", { status: 500 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-tts-preview",
            contents: [{ role: "user", parts: [{ text: `Say warmly, like a friendly salon receptionist answering the phone: ${greeting(salon)}` }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v.engine } } },
            },
            stream_format: "audio",
          }),
          signal: request.signal,
        });
        if (!res.ok || !res.body) {
          const msg = await res.text().catch(() => "");
          console.error("TTS error", res.status, msg.slice(0, 300));
          const friendly = res.status === 402 ? "AI credits have run out." : res.status === 429 ? "Too many previews right now, try again shortly." : "Preview unavailable right now.";
          return new Response(friendly, { status: res.status });
        }
        return new Response(res.body, {
          headers: { "Content-Type": res.headers.get("Content-Type") ?? "audio/wav", "Cache-Control": "private, no-store" },
        });
      },
    },
  },
});
