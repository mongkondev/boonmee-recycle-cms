/** A5 portrait at the same px scale as the A4 menu (1240×1754); rendered with pixelRatio 2 ≈ 300 dpi. */
export const A5 = { width: 874, height: 1240 };

/** Blank lines printed on a bill when it has fewer items (like a paper cash-bill pad). */
export const BILL_MIN_ROWS = 10;
export const BILL_MAX_ROWS = 30;

export const fmtBillNo = (id: number) => String(id).padStart(6, "0");

export const PAYMENT_LABEL = { cash: "เงินสด", transfer: "โอน" } as const;

export const fmtQty = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 3 });
export const fmtMoney = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** Integer → Thai words, millions handled recursively ("หนึ่งล้านสองแสน…"). */
function thaiNumber(n: number): string {
  if (n >= 1_000_000) return thaiNumber(Math.floor(n / 1_000_000)) + "ล้าน" + thaiNumber(n % 1_000_000);
  const s = String(n);
  let out = "";
  for (const [i, ch] of [...s].entries()) {
    const d = Number(ch);
    const place = s.length - i - 1;
    if (d === 0) continue;
    if (place === 0 && d === 1 && s.length > 1) out += "เอ็ด";
    else if (place === 1 && d === 2) out += "ยี่";
    else if (place === 1 && d === 1) out += "";
    else out += DIGITS[d];
    out += PLACES[place];
  }
  return out;
}

/** 1250.5 → "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์", 100 → "หนึ่งร้อยบาทถ้วน" */
export function bahtText(amount: number) {
  const satang = Math.round(amount * 100);
  const baht = Math.floor(satang / 100);
  const st = satang % 100;
  if (!baht && !st) return "ศูนย์บาทถ้วน";
  return (baht ? thaiNumber(baht) + "บาท" : "") + (st ? thaiNumber(st) + "สตางค์" : "ถ้วน");
}

export const bangkokDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
export const bangkokToday = () => bangkokDay(new Date());

/** Calendar helpers on Bangkok "YYYY-MM-DD" day strings. */
export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Monday of the week containing `day`. */
export const weekStart = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

export const fmtSaleNo = (id: number) => `S${String(id).padStart(6, "0")}`;
