import { createFileRoute } from "@tanstack/react-router";

// Fixed sample greeting in the voice of our live ElevenLabs demo agent.
// Text is fixed (no caller input) and the audio is cached, so anonymous visitors can't spend credits.
export const DEMO_VOICE_ID = "DODLEQrClDo8wCz460ld";
export const DEMO_GREETING =
  "Thanks for calling! This is your salon's receptionist. How can I help you today? I can check prices, find an open time, or book your appointment.";

let cached: ArrayBuffer | null = null;

export const Route = createFileRoute("/api/public/demo-voice")({
  server: {
    handlers: {
      GET: async () => {
        if (!cached) {
          const key = process.env["ELEVENLABS_API_KEY"];
          if (!key) return new Response("Voice sample unavailable", { status: 503 });
          const res = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${DEMO_VOICE_ID}?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: { "xi-api-key": key, "Content-Type": "application/json" },
              body: JSON.stringify({ text: DEMO_GREETING, model_id: "eleven_turbo_v2_5" }),
            },
          );
          if (!res.ok) {
            console.error("Demo voice TTS failed", res.status, (await res.text()).slice(0, 300));
            return new Response("Voice sample unavailable", { status: 502 });
          }
          cached = await res.arrayBuffer();
        }
        return new Response(cached, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
        });
      },
    },
  },
});
