import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Mic, PhoneOff } from "lucide-react";
import { getTestCallToken } from "@/lib/setup.functions";
import { Waveform } from "./primitives";

function Inner() {
  const getToken = useServerFn(getTestCallToken);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const c = useConversation({ onError: () => setErr("The call dropped. Please try again.") });
  const live = c.status === "connected";

  async function start() {
    setErr(null); setBusy(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { token } = await getToken();
      await c.startSession({ conversationToken: token, connectionType: "webrtc" });
    } catch (e) {
      setErr(e instanceof DOMException ? "Please allow microphone access." : (e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="glass mt-6 rounded-[28px] p-6 text-center">
      <div className="font-medium">Test your receptionist</div>
      <p className="mt-1 text-sm text-muted-foreground">Talk to it like a customer would — ask prices or book an appointment.</p>
      <div className="mt-5 flex h-10 items-center justify-center">
        {live ? <Waveform bars={28} className={c.isSpeaking ? "" : "opacity-40"} /> : <Mic className="size-7 text-muted-foreground" />}
      </div>
      {live ? (
        <button onClick={() => c.endSession()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-medium">
          <PhoneOff className="size-4" /> End test call
        </button>
      ) : (
        <button onClick={start} disabled={busy} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">
          <Mic className="size-4" /> {busy ? "Connecting…" : "Start test call"}
        </button>
      )}
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}

export function TestCall() {
  return <ConversationProvider><Inner /></ConversationProvider>;
}
