import type { SourceOption } from "./trade-queries";

/**
 * Which purchase lines (lots) a sale is deducted from. Shared by the sale form (live preview) and saveSale,
 * so what the form shows is what gets saved.
 */

export type AllocSource = {
  id: number;
  productId: number | null;
  title: string;
  unitName: string | null;
  /** quantity not yet sold as the same item in the same unit */
  qtyLeft: number;
  /** cost not yet recovered by sales */
  costLeft: number;
  /** offered to automatic matching (open lot, or already used by the sale being edited) */
  open: boolean;
};

export type AllocLine = {
  /** picked by hand: the whole line goes to this purchase line */
  sourceItemId: number | null;
  /** "ไม่ระบุ LOT": find the lots from the item, oldest first */
  auto: boolean;
  productId: number | null;
  title: string;
  unitName: string | null;
  qty: number;
  amount: number;
};

export type Alloc = { sourceId: number; qty: number | null; amount: number };

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

const sameName = (s: AllocSource, l: AllocLine) => (s.productId !== null && s.productId === l.productId) || norm(s.title) === norm(l.title);
/** the same item in the same unit: its quantity can be counted down */
export const sameItem = (s: AllocSource, l: Pick<AllocLine, "productId" | "title" | "unitName">) =>
  (s.unitName ?? "") === (l.unitName ?? "") && sameName(s, l as AllocLine);

/**
 * Allocate every line in order. `sources` must be oldest first; it is not modified.
 * - picked line → one allocation, quantity counted only for the same item / unit
 * - auto line → spread over the same item in open lots, oldest first, by quantity left; anything beyond
 *   what is left goes on the newest of them. Same name in another unit → the oldest one with cost left.
 *   Not found in any lot → no allocation (sold without a lot).
 */
export function allocate(lines: AllocLine[], sources: AllocSource[]): Alloc[][] {
  const left = new Map(sources.map((s) => [s.id, { qty: s.qtyLeft, cost: s.costLeft }]));
  const byId = new Map(sources.map((s) => [s.id, s]));
  const take = (id: number, qty: number | null, amount: number): Alloc => {
    const l = left.get(id);
    if (l) {
      if (qty !== null) l.qty = round(l.qty - qty, 3);
      l.cost = round(l.cost - amount, 2);
    }
    return { sourceId: id, qty, amount };
  };

  return lines.map((line) => {
    if (!line.qty || line.qty <= 0) return [];
    if (line.sourceItemId) {
      const s = byId.get(line.sourceItemId);
      return [take(line.sourceItemId, s && sameItem(s, line) ? line.qty : null, line.amount)];
    }
    if (!line.auto) return [];

    const same = sources.filter((s) => s.open && sameItem(s, line));
    if (!same.length) {
      const named = sources.filter((s) => s.open && sameName(s, line));
      const pick = named.find((s) => left.get(s.id)!.cost > 0) ?? named[0];
      return pick ? [take(pick.id, null, line.amount)] : [];
    }
    // split by quantity, oldest first
    const parts: { id: number; qty: number }[] = [];
    let rest = line.qty;
    for (const s of same) {
      const q = Math.min(rest, left.get(s.id)!.qty);
      if (q > 0) {
        parts.push({ id: s.id, qty: q });
        rest = round(rest - q, 3);
      }
      if (rest <= 0) break;
    }
    if (rest > 0) {
      const last = same.at(-1)!.id;
      const p = parts.find((x) => x.id === last);
      if (p) p.qty = round(p.qty + rest, 3);
      else parts.push({ id: last, qty: rest });
    }
    const unitPrice = line.amount / line.qty;
    let money = line.amount;
    return parts.map((p, i) => {
      const amount = i === parts.length - 1 ? round(money, 2) : round(p.qty * unitPrice, 2);
      money -= amount;
      return take(p.id, p.qty, amount);
    });
  });
}

/** Source options (newest first) in the shape the allocator takes, oldest first. */
export const toAllocSources = (sources: SourceOption[]): AllocSource[] =>
  sources.toReversed().map((s) => ({ ...s, costLeft: round(s.cost - s.sold, 2), open: true }));
