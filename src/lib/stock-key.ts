/**
 * Stock is tracked per item + unit: catalogue products by id, free-text lines by their name.
 * Must match the `key` expression in trade-queries.ts.
 */
export const stockKey = (productId: number | null, title: string, unitName: string | null) =>
  `${productId ? `p${productId}` : `t${title.trim().toLowerCase()}`}|${unitName ?? ""}`;
