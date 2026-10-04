import { z } from "zod";
import type { Service } from "./salon-data";
export const onboardingSchema = z.object({
  step: z.number().int().min(0).max(5).default(0),
  phoneIntent: z.enum(["forward", "new", "port"]).default("forward"),
  calendarIntent: z.enum(["square", "google", "salon_pro", "other", "unsure"]).default("unsure"),
  addonInterests: z
    .array(z.enum(["scheduling", "extra_location"]))
    .max(2)
    .default([]),
  areaCode: z
    .string()
    .regex(/^$|^[2-9][0-9]{2}$/)
    .default(""),
});
export type Onboarding = z.infer<typeof onboardingSchema>;
export function readOnboarding(draft: unknown): Onboarding {
  const r = onboardingSchema.safeParse((draft as { onboarding?: unknown })?.onboarding ?? {});
  return r.success ? r.data : onboardingSchema.parse({});
}
/** Only approved rows are merged. Keep stable IDs and every service absent from the proposal. */
export function mergeServiceProposal(existing: Service[], approved: Service[]): Service[] {
  const result = existing.map((s) => ({ ...s }));
  for (const row of approved) {
    const index = result.findIndex(
      (s) => s.name.trim().toLowerCase() === row.name.trim().toLowerCase(),
    );
    if (index >= 0)
      result[index] = {
        ...result[index],
        name: row.name,
        price: row.price,
        minutes: row.minutes,
        is_addon: row.is_addon,
      };
    else
      result.push({
        name: row.name,
        price: row.price,
        minutes: row.minutes,
        is_addon: row.is_addon,
      });
  }
  return result;
}
