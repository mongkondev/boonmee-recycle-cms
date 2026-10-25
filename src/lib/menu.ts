import { priceLabel } from "./trend";
import type { ProductRow, ShopSettings } from "./types";

/** Frozen menu data stored with each publication, so old menus re-render exactly as published. */
export type MenuItem = {
  id: number;
  title: string;
  priceText: string;
  unitName: string | null;
  imageId: string | null;
  price: number;
  prevPrice: number | null;
};
/** name is null for products placed directly under the main category */
export type MenuSub = { name: string | null; items: MenuItem[] };
export type MenuMain = { name: string; subs: MenuSub[] };
export type MenuSnapshot = { settings: ShopSettings; mains: MenuMain[] };

export function buildMenu(products: ProductRow[], settings: ShopSettings): MenuSnapshot {
  const mains: MenuMain[] = [];
  for (const p of products) {
    if (!(p.isActive && p.subActive && p.mainActive)) continue;
    let m = mains.at(-1);
    if (m?.name !== p.mainName) mains.push((m = { name: p.mainName, subs: [] }));
    let s = m.subs.at(-1);
    if (s?.name !== p.subName) m.subs.push((s = { name: p.subName, items: [] }));
    s.items.push({
      id: p.id,
      title: p.title,
      priceText: priceLabel(p),
      unitName: p.unitName,
      imageId: p.imageId,
      price: p.price,
      prevPrice: p.prevPrice,
    });
  }
  return { settings, mains };
}

/* ---------------- A4 pagination ----------------
 * Every row has a fixed pixel height, so page breaks are computed (not measured) and identical
 * on every render. Rule from the shop: a category must never be split across pages.
 */
export const A4 = {
  width: 1240,
  height: 1754,
  header: 268,
  footer: 104,
  bodyPadY: 36,
  pill: 56,
  pillGap: 10,
  blockGap: 30,
  row: 38,
};
export const BODY_H = A4.height - A4.header - A4.footer - A4.bodyPadY * 2;

export type MenuRow = { kind: "sub"; name: string } | { kind: "item"; item: MenuItem };
export type MenuBlock = { mainName: string; continued: boolean; columns: [MenuRow[], MenuRow[]] };
/** `used` = body height taken by blocks (px); the rest is free for illustrations */
export type MenuPage = { blocks: MenuBlock[]; used: number };

const blockHeight = (rows: number) => A4.pill + A4.pillGap + Math.ceil(rows / 2) * A4.row + A4.blockGap;
const rowsOf = (subs: MenuSub[], showSub: boolean): MenuRow[] =>
  subs.flatMap((s) => [
    ...(showSub && s.name ? [{ kind: "sub" as const, name: s.name }] : []),
    ...s.items.map((item) => ({ kind: "item" as const, item })),
  ]);

/** Split rows into two balanced columns without leaving a sub heading orphaned at the bottom of column 1. */
function toColumns(rows: MenuRow[]): [MenuRow[], MenuRow[]] {
  let cut = Math.ceil(rows.length / 2);
  if (rows[cut - 1]?.kind === "sub") cut -= 1;
  return [rows.slice(0, cut), rows.slice(cut)];
}

/** Largest number of rows that fit in one block on an empty page. */
const MAX_ROWS = Math.floor((BODY_H - A4.pill - A4.pillGap - A4.blockGap) / A4.row) * 2;

/** Cut an oversized category into page-sized chunks, preferring sub-category boundaries. */
function chunkMain(main: MenuMain, showSub: boolean): MenuRow[][] {
  const chunks: MenuRow[][] = [];
  let cur: MenuRow[] = [];
  for (const sub of main.subs) {
    const rows = rowsOf([sub], showSub);
    if (cur.length + rows.length <= MAX_ROWS) {
      cur.push(...rows);
      continue;
    }
    if (cur.length) chunks.push(cur);
    cur = [];
    // a single sub-category bigger than a page: unavoidable row split
    for (let i = 0; i < rows.length; i += MAX_ROWS) {
      const part = rows.slice(i, i + MAX_ROWS);
      if (part.length === MAX_ROWS) chunks.push(part);
      else cur = part;
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export function paginate(menu: MenuSnapshot, showSub = true): MenuPage[] {
  const pages: MenuPage[] = [{ blocks: [], used: 0 }];
  let used = 0;
  for (const main of menu.mains) {
    const rows = rowsOf(main.subs, showSub);
    const chunks = rows.length <= MAX_ROWS ? [rows] : chunkMain(main, showSub);
    chunks.forEach((chunk, i) => {
      const h = blockHeight(chunk.length);
      // whole category moves to the next page when it does not fit what is left
      if (used + h > BODY_H + A4.blockGap && pages.at(-1)!.blocks.length) {
        pages.push({ blocks: [], used: 0 });
        used = 0;
      }
      pages.at(-1)!.blocks.push({ mainName: main.name, continued: i > 0, columns: toColumns(chunk) });
      used += h;
      pages.at(-1)!.used = used;
    });
  }
  return pages;
}
