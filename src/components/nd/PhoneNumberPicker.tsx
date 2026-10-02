import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Phone } from "lucide-react";
import { claimNumber, findNumbers } from "@/lib/phone.functions";

type Num = { number: string; display: string; place: string };

export function PhoneNumberPicker({ onClaimed }: { onClaimed: (n: string) => void }) {
  const find = useServerFn(findNumbers);
  const claim = useServerFn(claimNumber);
  const [area, setArea] = useState("");
  const [list, setList] = useState<Num[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function search() {
    setErr(null); setBusy("search");
    const r = await find({ data: { areaCode: area } });
    setList(r.numbers); setErr(r.error ?? (r.numbers.length ? null : "No numbers found there — try another area code."));
    setBusy(null);
  }
  async function pick(n: Num) {
    if (!confirm(`Use ${n.display} as your salon's NailDesk number?`)) return;
    setErr(null); setBusy(n.number);
    const r = await claim({ data: { number: n.number } });
    setBusy(null);
    if (r.error) setErr(r.error); else onClaimed(r.number!);
  }

  return (
    <div className="glass mt-6 rounded-[28px] p-6">
      <div className="font-medium">Choose your salon's phone number</div>
      <p className="mt-1 text-sm text-muted-foreground">Customers who call this number reach your receptionist. Pick a local area code.</p>
      <div className="mt-4 flex gap-2">
        <input
          value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="Area code, e.g. 480" inputMode="numeric"
          className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm"
        />
        <button onClick={search} disabled={busy === "search"} className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
          {busy === "search" ? <Loader2 className="size-4 animate-spin" /> : "Find numbers"}
        </button>
      </div>
      {list && list.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {list.map((n) => (
            <li key={n.number} className="flex items-center justify-between py-3">
              <div><div className="font-medium">{n.display}</div><div className="text-xs text-muted-foreground">{n.place}</div></div>
              <button onClick={() => pick(n)} disabled={!!busy} className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm">
                {busy === n.number ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />} Use this
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}
