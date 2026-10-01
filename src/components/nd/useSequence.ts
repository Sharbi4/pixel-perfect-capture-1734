import { useEffect, useState } from "react";

/** Advances a step index through `delays` (ms before each next step), then loops. */
export function useSequence(delays: number[], loopPause = 3500) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const wait = step < delays.length ? delays[step] : loopPause;
    const t = setTimeout(() => setStep((s) => (s >= delays.length ? 0 : s + 1)), wait);
    return () => clearTimeout(t);
  }, [step, delays, loopPause]);
  return step;
}
