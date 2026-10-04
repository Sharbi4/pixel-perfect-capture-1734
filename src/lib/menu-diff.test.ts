import { describe, expect, it } from "vitest";
import { diffMenu, summarize } from "./menu-diff";

const live = [
  { id: "1", name: "Gel Manicure", price: 45, minutes: 45, is_addon: false, archived: false },
  { id: "2", name: "Classic Pedicure", price: 40, minutes: 45, is_addon: false, archived: false },
  { id: "3", name: "French Add-On", price: 10, minutes: 10, is_addon: true, archived: false },
  { id: "4", name: "Old Service", price: 5, minutes: 10, is_addon: false, archived: true },
];

describe("diffMenu", () => {
  it("finds adds, price changes and removals without touching unchanged items", () => {
    const c = diffMenu(live, [
      { name: "gel manicure", price: 50, minutes: 45, is_addon: false },
      { name: "French add on", price: 10, minutes: 10, is_addon: true },
      { name: "Dip Powder", price: 55, minutes: 60, is_addon: false },
    ]);
    expect(summarize(c)).toEqual({ add: 1, price: 1, other: 0, remove: 1 });
    expect(c.find((x) => x.kind === "remove")).toMatchObject({ prev: { id: "2" } });
  });
  it("restores an archived service when it reappears and ignores duplicates", () => {
    const c = diffMenu(live, [{ name: "Old Service", price: 5, minutes: 10, is_addon: false }, { name: "Old service", price: 9, minutes: 10, is_addon: false }]);
    expect(c.find((x) => x.kind === "update")).toMatchObject({ id: "4", restore: true, price: false });
  });
});
