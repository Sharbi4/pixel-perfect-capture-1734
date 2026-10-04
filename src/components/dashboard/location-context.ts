import { createContext, useContext } from "react";
import type { Location } from "@/lib/locations";

export type LocationCtxValue = { location: Location; locations: Location[] };
export const LocationCtx = createContext<LocationCtxValue | null>(null);
export function useActiveLocation() {
  const c = useContext(LocationCtx);
  if (!c) throw new Error("useActiveLocation outside dashboard");
  return c;
}
