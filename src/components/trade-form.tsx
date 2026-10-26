"use client";

import { Banknote, FileCheck2, Landmark, LoaderCircle, Plus, Save, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { PriceInput } from "@/components/price-input";
import { Button, Card, cn, FormError, Input, Label } from "@/components/ui";
import { saveBill } from "@/lib/bill-actions";
import { BILL_MAX_ROWS, BILL_MIN_ROWS, fmtMoney, fmtQty } from "@/lib/bill";
import { stockKey } from "@/lib/stock-key";
import { saveSale } from "@/lib/trade-actions";
import { fmtPrice } from "@/lib/trend";

/** A pickable line: a catalogue product (buying) or a stock item (selling). */
export type TradeOption = {
  key: string;
  productId: number | null;
  title: string;
  group: string;
  unitName: string | null;
  /** price filled in when picked */
  price: number | null;
  /** selling only: how much is left in stock */
  remaining?: number;
  avgCost?: number;
};

type Row = { key: number; productId: number | null; title: string; unitName: string; qty: string; unitPrice: string };

export type TradeFormValues = {
  id?: number;
  party: string;
  date: string;
  paymentMethod: "cash" | "transfer";
  note: string;
  /** buying only: the purchase already has a bill number */
  hasBillNo?: boolean;
  rows: Omit<Row, "key">[];
};

const TEXT = {
  buy: { party: "ชื่อลูกค้า (ผู้ขายของให้ร้าน)", price: "ราคา/หน่วย", search: "ค้นหาหรือพิมพ์รายการ" },
  sell: { party: "ผู้ซื้อ / โรงงาน", price: "ราคาขาย/หน่วย", search: "ค้นหาจากสต็อก" },
};

let nextKey = 0;
const blankRow = (): Row => ({ key: nextKey++, productId: null, title: "", unitName: "", qty: "", unitPrice: "" });
const num = (s: string) => (s === "" || s === "." ? NaN : Number(s));
const amountOf = (r: Row) => {
  const v = num(r.qty) * num(r.unitPrice);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
};
const rowKey = (r: Row) => stockKey(r.productId, r.title, r.unitName.trim() || null);

/** Line-item form shared by รับซื้อเข้า (bills) and ขายออก (sales). */
export function TradeForm({ mode, options, initial }: { mode: "buy" | "sell"; options: TradeOption[]; initial: TradeFormValues }) {
  const router = useRouter();
  const text = TEXT[mode];
  const selling = mode === "sell";
  const [head, setHead] = useState({ party: initial.party, date: initial.date, paymentMethod: initial.paymentMethod, note: initial.note });
  const [rows, setRows] = useState<Row[]>(() => {
    const filled = initial.rows.map((r) => ({ ...r, key: nextKey++ }));
    return [...filled, ...Array.from({ length: Math.max(0, BILL_MIN_ROWS - filled.length) }, blankRow)];
  });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const reg = (key: number, field: string) => (el: HTMLInputElement | null) => {
    if (el) inputs.current.set(`${key}:${field}`, el);
    else inputs.current.delete(`${key}:${field}`);
  };
  const focus = (key: number, field: string) => setTimeout(() => inputs.current.get(`${key}:${field}`)?.focus(), 0);
  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);

  const total = rows.reduce((s, r) => s + amountOf(r), 0);
  const filledCount = rows.filter((r) => r.title.trim()).length;
  // selling: quantity already put on other rows of this form, per stock item
  const usedQty = new Map<string, number>();
  for (const r of rows) if (r.title && num(r.qty) > 0) usedQty.set(rowKey(r), (usedQty.get(rowKey(r)) ?? 0) + num(r.qty));

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const addRow = () => {
    if (rows.length >= BILL_MAX_ROWS) return;
    const r = blankRow();
    setRows((rs) => [...rs, r]);
    focus(r.key, "title");
  };

  /** Next row's title field; grows the form when Enter is pressed on the last row. */
  const goNextRow = (key: number) => {
    const i = rows.findIndex((r) => r.key === key);
    if (i < rows.length - 1) focus(rows[i + 1].key, "title");
    else addRow();
  };

  const pick = (key: number, o: TradeOption) => {
    patch(key, { productId: o.productId, title: o.title, unitName: o.unitName ?? "", unitPrice: o.price === null ? "" : String(o.price) });
    focus(key, "qty");
  };

  const removeRow = (key: number) =>
    setRows((rs) => {
      const left = rs.filter((r) => r.key !== key);
      return left.length >= BILL_MIN_ROWS ? left : [...left, blankRow()];
    });

  async function submit(issueBill: boolean) {
    setError(undefined);
    const used = rows.filter((r) => r.title.trim() || r.qty || r.unitPrice);
    for (const r of used) {
      const n = rows.indexOf(r) + 1;
      if (!r.title.trim()) return setError(`แถวที่ ${n}: กรุณากรอกชื่อรายการ`);
      if (selling && !byKey.has(rowKey(r))) return setError(`แถวที่ ${n}: กรุณาเลือกรายการจากสต็อก`);
      if (!(num(r.qty) > 0)) return setError(`แถวที่ ${n}: กรุณากรอกจำนวน`);
      if (!Number.isFinite(num(r.unitPrice))) return setError(`แถวที่ ${n}: กรุณากรอก${text.price}`);
    }
    if (!used.length) return setError("กรุณาเพิ่มอย่างน้อย 1 รายการ");
    if (selling) {
      for (const [k, q] of usedQty) {
        const o = byKey.get(k);
        if (o && q > (o.remaining ?? 0) + 1e-9) return setError(`"${o.title}" เหลือขายได้ ${fmtQty(o.remaining ?? 0)} ${o.unitName ?? ""}`);
      }
    }
    setSaving(issueBill ? "bill" : "save");
    const items = used.map((r) => ({
      productId: r.productId,
      title: r.title,
      unitName: r.unitName.trim() || null,
      qty: num(r.qty),
      unitPrice: num(r.unitPrice),
    }));
    const common = { id: initial.id, paymentMethod: head.paymentMethod, note: head.note, items };
    const res = selling
      ? await saveSale({ ...common, buyerName: head.party, saleDate: head.date })
      : await saveBill({ ...common, customerName: head.party, billDate: head.date, issueBill });
    if (!res.ok) {
      setSaving(null);
      return setError(res.error);
    }
    router.push(selling ? `/sales?saved=${res.data!.id}` : `/bills/${res.data!.id}?fresh=1`);
  }

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 p-4 sm:grid-cols-[1fr_12rem] sm:p-5">
        <div>
          <Label htmlFor="party">{text.party}</Label>
          <Input id="party" value={head.party} maxLength={120} placeholder="ไม่บังคับ" onChange={(e) => setHead({ ...head, party: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="date" required>วันที่</Label>
          <Input id="date" type="date" value={head.date} onChange={(e) => setHead({ ...head, date: e.target.value })} />
        </div>
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="mb-2 hidden grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_5.5rem_7.5rem_8rem_2.25rem] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
          <span className="text-center">ลำดับ</span>
          <span>รายการ</span>
          <span className="text-right">จำนวน</span>
          <span>หน่วย</span>
          <span className="text-right">{text.price}</span>
          <span className="text-right">ราคารวม</span>
          <span />
        </div>
        <div className="divide-y divide-slate-100 sm:divide-y-0">
          {rows.map((r, i) => {
            const stock = selling && r.title ? byKey.get(rowKey(r)) : undefined;
            const over = stock && (usedQty.get(rowKey(r)) ?? 0) > (stock.remaining ?? 0) + 1e-9;
            return (
              <div key={r.key} className="py-2.5 sm:py-1">
                <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_2.25rem] items-center gap-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_5.5rem_7.5rem_8rem_2.25rem]">
                  <span className="text-center text-sm text-slate-400 tabular-nums">{i + 1}</span>
                  <ItemPicker
                    inputRef={reg(r.key, "title")}
                    value={r.title}
                    linked={selling ? !!stock : r.productId !== null}
                    options={options}
                    placeholder={text.search}
                    selling={selling}
                    onType={(title) => patch(r.key, { title, productId: null, ...(selling && { unitName: "" }) })}
                    onPick={(o) => pick(r.key, o)}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-accent-50 hover:text-accent-500 sm:order-last"
                    aria-label={`ลบแถวที่ ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                  {/* on phones the numbers wrap to a second line under the item name */}
                  <div className="col-span-3 grid grid-cols-[1fr_4.5rem_1fr] gap-2 pl-[2.25rem] sm:contents">
                    <PriceInput
                      ref={reg(r.key, "qty")}
                      value={r.qty}
                      onValueChange={(qty) => patch(r.key, { qty })}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), focus(r.key, "price"))}
                      placeholder="จำนวน"
                      aria-label={`จำนวน แถวที่ ${i + 1}`}
                      aria-invalid={over || undefined}
                      className={cn(
                        "h-10 w-full rounded-lg border px-2.5 text-right text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15",
                        over ? "border-accent-500 bg-accent-50" : "border-slate-200",
                      )}
                    />
                    <input
                      value={r.unitName}
                      maxLength={40}
                      readOnly={selling}
                      tabIndex={selling ? -1 : undefined}
                      onChange={(e) => patch(r.key, { unitName: e.target.value })}
                      placeholder="หน่วย"
                      aria-label={`หน่วย แถวที่ ${i + 1}`}
                      className={cn(
                        "h-10 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15",
                        selling && "bg-slate-50 text-slate-500",
                      )}
                    />
                    <PriceInput
                      ref={reg(r.key, "price")}
                      value={r.unitPrice}
                      onValueChange={(unitPrice) => patch(r.key, { unitPrice })}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), goNextRow(r.key))}
                      placeholder="ราคา/หน่วย"
                      aria-label={`${text.price} แถวที่ ${i + 1}`}
                      className="h-10 w-full rounded-lg border border-slate-200 px-2.5 text-right text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                    />
                    <div className="col-span-3 flex items-center justify-end gap-2 text-sm sm:col-span-1">
                      <span className="text-xs text-slate-400 sm:hidden">ราคารวม</span>
                      <span className={cn("font-semibold tabular-nums", amountOf(r) ? "text-ink-900" : "text-slate-300")}>{fmtMoney(amountOf(r))}</span>
                    </div>
                  </div>
                </div>
                {stock && (
                  <p className={cn("mt-1 pl-[2.25rem] text-xs sm:pl-[3rem]", over ? "text-accent-600" : "text-slate-400")}>
                    เหลือขายได้ {fmtQty(stock.remaining ?? 0)} {stock.unitName} · ทุนเฉลี่ย {fmtPrice(Math.round((stock.avgCost ?? 0) * 100) / 100)}/{stock.unitName ?? "หน่วย"}
                    {over && " — เกินจำนวนคงเหลือ"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="secondary" onClick={addRow} disabled={rows.length >= BILL_MAX_ROWS}>
            <Plus className="size-4" /> เพิ่มแถว
          </Button>
          <span className="text-xs text-slate-400">
            {filledCount} รายการ · สูงสุด {BILL_MAX_ROWS} แถว · Enter ที่ช่องราคาเพื่อไปแถวถัดไป
          </span>
        </div>
      </Card>

      <Card className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div>
            <Label>{selling ? "รับเงิน" : "การจ่าย"}</Label>
            <div className="grid max-w-sm grid-cols-2 gap-2">
              {([
                ["cash", "เงินสด", Banknote],
                ["transfer", "โอน", Landmark],
              ] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHead({ ...head, paymentMethod: m })}
                  aria-pressed={head.paymentMethod === m}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-medium transition",
                    head.paymentMethod === m ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  <Icon className="size-5" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="note">หมายเหตุ</Label>
            <Input id="note" value={head.note} maxLength={500} placeholder="ไม่บังคับ" onChange={(e) => setHead({ ...head, note: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-xl bg-ink-900 p-5 text-white lg:min-w-80">
          <div>
            <div className="text-sm text-brand-200">รวมทั้งหมด</div>
            <div className="text-4xl font-bold tabular-nums">
              {fmtMoney(total)} <span className="text-base font-normal text-white/60">บาท</span>
            </div>
          </div>
          {selling || initial.hasBillNo ? (
            <Button onClick={() => submit(false)} disabled={!!saving} className="h-12 text-base">
              {saving ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />} {selling ? "บันทึกการขาย" : "บันทึก"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button onClick={() => submit(true)} disabled={!!saving} className="h-12 w-full text-base">
                {saving === "bill" ? <LoaderCircle className="size-5 animate-spin" /> : <FileCheck2 className="size-5" />} บันทึก + ออกบิล
              </Button>
              <Button
                variant="ghost"
                onClick={() => submit(false)}
                disabled={!!saving}
                className="w-full text-white/80 hover:bg-white/10 hover:text-white"
              >
                {saving === "save" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} บันทึกรับซื้อ (ยังไม่ออกบิล)
              </Button>
            </div>
          )}
        </div>
      </Card>
      <FormError message={error} />
    </div>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Item name field with a searchable list. Buying allows free text for items not in the catalogue. */
export function ItemPicker({
  value,
  linked,
  options,
  placeholder,
  selling,
  inputRef,
  onType,
  onPick,
}: {
  value: string;
  linked: boolean;
  options: TradeOption[];
  placeholder: string;
  selling: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onType: (v: string) => void;
  onPick: (o: TradeOption) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // once an item is chosen show the whole list again, not just that one match
  const query = linked ? "" : value;
  const matches = useMemo(() => {
    const q = norm(query);
    const list = q ? options.filter((o) => norm(`${o.title} ${o.group}`).includes(q)) : options;
    return list.slice(0, 50);
  }, [query, options]);

  const choose = (o: TradeOption) => {
    setOpen(false);
    onPick(o);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-300" />
      <input
        ref={inputRef}
        value={value}
        maxLength={200}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        // open on tap/typing, not on focus: rows focused by the keyboard flow should not cover the form
        onClick={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "h-10 w-full rounded-lg border bg-white pr-2.5 pl-8 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15",
          linked ? "border-brand-200 bg-brand-50/40 font-medium" : "border-slate-200",
        )}
      />
      {open && (matches.length > 0 || selling) && (
        <ul id={listId} role="listbox" className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl sm:right-auto sm:min-w-96">
          {matches.length === 0 && <li className="px-3 py-3 text-sm text-slate-400">ไม่พบรายการที่ยังเหลือในสต็อก</li>}
          {matches.map((o, i) => (
            <li key={o.key}>
              <button
                type="button"
                // mousedown fires before the input's blur, so the list is still there to click
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-3 px-3 py-2 text-left", i === active && "bg-brand-50")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{o.title}</span>
                  <span className="block truncate text-xs text-slate-400">{o.group}</span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  {selling ? (
                    <>
                      <span className="block font-semibold text-brand-700">
                        เหลือ {fmtQty(o.remaining ?? 0)} <span className="text-xs font-normal text-slate-400">{o.unitName}</span>
                      </span>
                      <span className="block text-xs text-slate-400">ทุน ~{fmtMoney((o.remaining ?? 0) * (o.avgCost ?? 0))} ฿</span>
                    </>
                  ) : (
                    o.price !== null && (
                      <span className="font-semibold text-brand-700">
                        {fmtPrice(o.price)}
                        {o.unitName && <span className="text-xs font-normal text-slate-400">/{o.unitName}</span>}
                      </span>
                    )
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
