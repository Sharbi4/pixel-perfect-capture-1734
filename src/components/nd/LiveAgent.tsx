import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useState } from "react";
import { Mic, PhoneOff } from "lucide-react";
import { Reveal, SectionHead, Waveform, ndButton } from "./primitives";

function LiveAgentInner() {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversation = useConversation({
    onError: (e) => setError(typeof e === "string" ? e : "Connection problem. Please try again."),
  });
  const live = conversation.status === "connected";

  const start = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/public/agent-token");
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error ?? "Could not start the call");
      await conversation.startSession({ conversationToken: data.token, connectionType: "webrtc" });
    } catch (e) {
      setError(
        e instanceof DOMException ? "Please allow microphone access to talk to NailDesk." : (e as Error).message,
      );
    } finally {
      setConnecting(false);
    }
  }, [conversation]);

  return (
    <section id="talk" className="px-4 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <SectionHead
          eyebrow="Live demo"
          title={<>Talk to NailDesk <span className="text-gradient">right now</span></>}
          body="Ask about prices, book a gel manicure, or try to stump it. This is the real AI receptionist — use your microphone."
        />
        <Reveal>
          <div className="glass mt-10 rounded-3xl p-10">
            <div className="flex h-16 items-center justify-center">
              {live ? (
                <Waveform bars={32} className={conversation.isSpeaking ? "" : "opacity-40"} />
              ) : (
                <Mic className="size-10 text-muted-foreground" />
              )}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {live ? (conversation.isSpeaking ? "NailDesk is speaking…" : "Listening — go ahead and talk") : "Ready when you are"}
            </p>
            <div className="mt-6">
              {live ? (
                <button className={ndButton({ variant: "ghost", size: "lg" })} onClick={() => conversation.endSession()}>
                  <PhoneOff className="size-4" /> End call
                </button>
              ) : (
                <button className={ndButton({ variant: "brand", size: "lg" })} onClick={start} disabled={connecting}>
                  <Mic className="size-4" /> {connecting ? "Connecting…" : "Start talking"}
                </button>
              )}
            </div>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LiveAgent() {
  return (
    <ConversationProvider>
      <LiveAgentInner />
    </ConversationProvider>
  );
}
