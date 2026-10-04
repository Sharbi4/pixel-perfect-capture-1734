export type CatalogItem = {
  id: string;
  is_deleted?: boolean;
  item_data?: {
    name?: string;
    product_type?: string;
    description?: string;
    variations?: {
      id: string;
      version?: number;
      is_deleted?: boolean;
      item_variation_data?: {
        name?: string;
        available_for_booking?: boolean;
        price_money?: { amount?: number; currency?: string };
        service_duration?: number;
      };
    }[];
  };
};
export type SquareService = {
  name: string;
  variationId: string;
  version: number;
  price: number;
  minutes: number;
  description: string;
};
export function catalogServices(items: CatalogItem[]): SquareService[] {
  const out: SquareService[] = [];
  for (const item of items) {
    const d = item.item_data;
    if (item.is_deleted || d?.product_type !== "APPOINTMENTS_SERVICE" || !d.name?.trim()) continue;
    for (const v of d.variations ?? []) {
      const x = v.item_variation_data;
      const amount = x?.price_money?.amount;
      const duration = x?.service_duration;
      if (
        v.is_deleted ||
        !x?.available_for_booking ||
        x.price_money?.currency !== "USD" ||
        !Number.isSafeInteger(amount) ||
        amount! < 0 ||
        !duration ||
        duration <= 0 ||
        duration % 60000 !== 0 ||
        !Number.isSafeInteger(v.version)
      )
        continue;
      out.push({
        name: x.name && x.name !== "Regular" ? d.name.trim() + " — " + x.name : d.name.trim(),
        variationId: v.id,
        version: v.version!,
        price: amount! / 100,
        minutes: duration / 60000,
        description: d.description ?? "",
      });
    }
  }
  return out;
}
/** Paginate completely; do not silently treat a partial catalog as a complete menu. */
export async function readSquareCatalog(
  api: (path: string) => Promise<unknown>,
): Promise<SquareService[]> {
  let cursor = "";
  const seen = new Set<string>();
  const items: CatalogItem[] = [];
  do {
    const r = (await api(
      "/v2/catalog/list?types=ITEM" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
    )) as { objects?: CatalogItem[]; cursor?: string };
    items.push(...(r.objects ?? []));
    cursor = r.cursor ?? "";
    if (cursor && seen.has(cursor)) throw Error("Square repeated a catalog page. Please retry.");
    seen.add(cursor);
    if (seen.size > 100) throw Error("This catalog needs help from the launch team to import.");
  } while (cursor);
  return catalogServices(items);
}
