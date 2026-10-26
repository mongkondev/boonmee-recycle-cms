export type Trend = { dir: "up" | "down" | "flat" | "new"; diff: number; pct: number };

export function trendOf(price: number, prev: number | null): Trend {
  if (prev === null) return { dir: "new", diff: 0, pct: 0 };
  const diff = price - prev;
  const pct = prev === 0 ? 0 : (diff / prev) * 100;
  return { dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat", diff, pct };
}

export const fmtPrice = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Numbers inside a free-text price such as "3000-30000" or "100+" get thousands separators. */
// numbers may already carry separators ("3,000"), so commas are part of the match and stripped first
export const fmtPriceNote = (note: string) =>
  note.replace(/\d[\d,]*(?:\.\d+)?/g, (n) => fmtPrice(Number(n.replace(/,/g, ""))));

export const priceLabel = (p: { price: number; priceNote: string | null }) =>
  p.priceNote ? fmtPriceNote(p.priceNote) : fmtPrice(p.price);

export const fmtDate = (d: string | Date | null) =>
  d
    ? new Date(d).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
    : "—";
