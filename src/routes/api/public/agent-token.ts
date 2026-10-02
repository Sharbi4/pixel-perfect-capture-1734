import { createFileRoute } from "@tanstack/react-router";

const AGENT_ID = "agent_8001m3x53ttzfnfbf69ypjankes9";

export const Route = createFileRoute("/api/public/agent-token")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env['ELEVENLABS_API_KEY'];
        if (!key) return Response.json({ error: "Voice demo not configured" }, { status: 500 });
        const res = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`,
          { headers: { "xi-api-key": key } },
        );
        if (!res.ok) {
          const body = await res.text();
          console.error(`ElevenLabs token failed [${res.status}]: ${body}`);
          return Response.json({ error: "Could not start the demo call" }, { status: res.status });
        }
        const { token } = await res.json();
        return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
