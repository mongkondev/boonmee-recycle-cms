"use client";

import { Banknote, Eye, FileCheck2, Landmark, LoaderCircle, Package, Plus, Save, Search, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { PriceInput } from "@/components/price-input";
import { Button, Card, cn, FormError, Input, Label, PageHeader } from "@/components/ui";
import { saveBill } from "@/lib/bill-actions";
import { BILL_MAX_ROWS, BILL_MIN_ROWS, fmtBillNo, fmtMoney, fmtQty, fmtSaleNo } from "@/lib/bill";
import { allocate, toAllocSources } from "@/lib/allocate";
import { saveSale } from "@/lib/trade-actions";
import type { Customer, SourceOption } from "@/lib/trade-queries";
import { fmtPrice } from "@/lib/trend";
import type { ShopSettings } from "@/lib/types";
import { DocPreview } from "./doc-preview";
import { SlipField } from "./slips";

/** A catalogue item that can be put on a line. */
export type TradeOption = {
  key: string;
  productId: number | null;
  title: string;
  group: string;
  unitName: string | null;
  /** price filled in when picked */
  price: number | null;
  /** selling: a purchase line of an open lot, deducted from when picked */
  sourceId?: number;
};

type Row = {
  key: number;
  /** selling: rows of one group share the lot they are sold from */
  group: number;
  /** buying: the existing purchase line being edited */
  itemId?: number;
  /** selling: the lot this row's group sells from */
  lotId?: number | null;
  /** selling: the purchase line this sale is deducted from (its lot's balance goes down) */
  sourceItemId: number | null;
  /** selling: not tied to one lot; each line picks an item from any open lot (or the mixed pile) */
  noLot?: boolean;
  /** selling, "ไม่ระบุ LOT": the lots are found from the item, oldest first (no line picked) */
  auto?: boolean;
  /** selling: text typed into the lot search before a lot is picked */
  sourceQuery?: string;
  productId: number | null;
  title: string;
  unitName: string;
  qty: string;
  unitPrice: string;
};

export type Party = { name: string; phone: string; bankName: string; bankAccount: string };

export type TradeFormValues = {
  id?: number;
  party: Party;
  date: string;
  paymentMethod: "cash" | "transfer";
  note: string;
  /** buying only: the purchase already has a bill number */
  hasBillNo?: boolean;
  billNo?: number | null;
  /** buying only: lot number of an existing purchase, and the internal lot note */
  lotNo?: string;
  lotNote?: string;
  /** image ids of attached payment slips */
  slips?: string[];
  /** selling: image ids of the buyer's own bill / receipt */
  bills?: string[];
  rows: Omit<Row, "key" | "group">[];
};

const TEXT = {
  buy: { party: "ชื่อลูกค้า (ผู้ขายของให้ร้าน)", price: "ราคา/หน่วย" },
  sell: { party: "ผู้ซื้อ / โรงงาน", price: "ราคาขาย/หน่วย" },
};

let nextKey = 0;
const blankRow = (group = 0, lotId: number | null = null, noLot = false, sourceItemId: number | null = null): Row => ({
  key: nextKey++,
  group,
  lotId,
  sourceItemId,
  noLot,
  auto: noLot && !sourceItemId,
  productId: null,
  title: "",
  unitName: "",
  qty: "",
  unitPrice: "",
});
type Lot = { id: number; lotNo: string; lotNote: string | null; customerName: string | null; items: SourceOption[]; remaining: number };

const num = (s: string) => (s === "" || s === "." ? NaN : Number(s));
const amountOf = (r: Row) => {
  const v = num(r.qty) * num(r.unitPrice);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
};
const inputCls = "h-10 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15";

/** Line-item form shared by รับซื้อเข้า (bills) and ขายออก (sales). */
export function TradeForm({
  mode,
  products,
  sources = [],
  customers,
  units,
  settings,
  initial,
  title,
  description,
}: {
  title: string;
  description?: string;
  mode: "buy" | "sell";
  products: TradeOption[];
  /** unit names offered in the unit dropdown */
  units: string[];
  /** for the A5 preview */
  settings: ShopSettings;
  sources?: SourceOption[];
  customers: Customer[];
  initial: TradeFormValues;
}) {
  const router = useRouter();
  const text = TEXT[mode];
  const selling = mode === "sell";
  const [head, setHead] = useState({
    date: initial.date,
    paymentMethod: initial.paymentMethod,
    note: initial.note,
    lotNote: initial.lotNote ?? "",
  });
  const [party, setParty] = useState<Party>(initial.party);
  // a purchase bill prints like a 10-line paper pad; sales lines carry a lot picker each, so start with fewer
  const minRows = selling ? 3 : BILL_MIN_ROWS;
  const [rows, setRows] = useState<Row[]>(() => {
    const lotOf = new Map(sources.map((s) => [s.id, s.lotId]));
    // consecutive lines sold from the same lot form one group
    let group = 0;
    let prevKey: string | undefined;
    const filled = initial.rows.map((r) => {
      const lotId = r.noLot ? null : (r.lotId ?? (r.sourceItemId ? lotOf.get(r.sourceItemId) : null) ?? null);
      const k = r.noLot ? "none" : String(lotId);
      if (prevKey !== undefined && prevKey !== k) group++;
      prevKey = k;
      return { ...r, lotId, group, key: nextKey++ };
    });
    const last = filled.at(-1);
    return [
      ...filled,
      ...Array.from({ length: Math.max(0, minRows - filled.length) }, () => blankRow(group, last?.lotId ?? null, !!last?.noLot)),
    ];
  });
  const groups = [...new Set(rows.map((r) => r.group))];
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [slips, setSlips] = useState<string[]>(initial.slips ?? []);
  const [billImages, setBillImages] = useState<string[]>(initial.bills ?? []);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const reg = (key: number, field: string) => (el: HTMLInputElement | null) => {
    if (el) inputs.current.set(`${key}:${field}`, el);
    else inputs.current.delete(`${key}:${field}`);
  };
  const focus = (key: number, field: string) => setTimeout(() => inputs.current.get(`${key}:${field}`)?.focus(), 0);

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  // open lots, each with the purchase lines still in it
  const lots = useMemo(() => {
    const m = new Map<number, Lot>();
    for (const s of sources) {
      const lot = m.get(s.lotId) ?? { id: s.lotId, lotNo: s.lotNo, lotNote: s.lotNote, customerName: s.customerName, items: [], remaining: 0 };
      lot.items.push(s);
      lot.remaining = Math.round((lot.remaining + s.remaining) * 100) / 100;
      m.set(s.lotId, lot);
    }
    return m;
  }, [sources]);
  const lotOptions = useMemo(
    () => [
      { key: "none", title: "ไม่ระบุ LOT", group: "หยิบของจาก LOT ไหนก็ได้ที่ยังเปิดอยู่ · หักทุนตามของที่เลือก", lot: null as Lot | null },
      ...[...lots.values()].map((l) => ({
        key: String(l.id),
        title: l.lotNo,
        group: [`${l.items.length} รายการ`, l.items.map((i) => i.title).join(", "), l.lotNote, l.customerName].filter(Boolean).join(" · "),
        lot: l as Lot | null,
      })),
    ],
    [lots],
  );
  // selling: the lot's own items come first in a line's search, then the catalogue (e.g. copper taken out of a fridge)
  const lotItemOptions = useMemo(() => {
    const opt = (s: SourceOption): TradeOption => ({
      key: `s${s.id}`,
      productId: s.productId,
      title: s.title,
      group: `${s.lotNo} · ซื้อ ${fmtQty(s.qty)} เหลือ ${fmtQty(s.qtyLeft)} ${s.unitName ?? ""} · ทุนเหลือ ${fmtMoney(s.remaining)}`,
      unitName: s.unitName,
      price: null,
      sourceId: s.id,
    });
    const all = sources.map(opt);
    return { all: [...all, ...products], byLot: new Map([...lots.values()].map((l) => [l.id, [...l.items.map(opt), ...products]])) };
  }, [sources, lots, products]);
  const rowOptions = (r: Row) => (!selling ? products : r.lotId ? (lotItemOptions.byLot.get(r.lotId) ?? products) : r.noLot ? lotItemOptions.all : products);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        key: String(c.id),
        title: c.name,
        group: [c.phone, c.bankName && `${c.bankName} ${c.bankAccount ?? ""}`].filter(Boolean).join(" · ") || "ลูกค้าเดิม",
        customer: c,
      })),
    [customers],
  );

  const total = rows.reduce((s, r) => s + amountOf(r), 0);
  const filledCount = rows.filter((r) => r.title.trim()).length;
  // selling: money put against each purchase line by this form
  // what saving would deduct from which purchase line (same rules as the server)
  const allocSources = useMemo(() => toAllocSources(sources), [sources]);
  const plan = selling
    ? allocate(
        rows.map((r) => ({
          sourceItemId: r.lotId || r.noLot ? r.sourceItemId : null,
          auto: !!r.noLot && !!r.auto && !r.sourceItemId,
          productId: r.productId,
          title: r.title,
          unitName: r.unitName.trim() || null,
          qty: num(r.qty) || 0,
          amount: amountOf(r),
        })),
        allocSources,
      )
    : [];
  const usedBySource = new Map<number, number>();
  const qtyBySource = new Map<number, number>();
  for (const a of plan.flat()) {
    usedBySource.set(a.sourceId, (usedBySource.get(a.sourceId) ?? 0) + a.amount);
    if (a.qty !== null) qtyBySource.set(a.sourceId, (qtyBySource.get(a.sourceId) ?? 0) + a.qty);
  }
  const [closeLots, setCloseLots] = useState<number[]>([]);

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  /** Add a line (selling: inside `group`, sold from the same lot as the rest of the group). */
  const addRow = (group = groups.at(-1) ?? 0) => {
    if (rows.length >= BILL_MAX_ROWS) return;
    const first = rows.find((x) => x.group === group);
    const lot = first?.lotId ? lots.get(first.lotId) : undefined;
    const r = blankRow(group, first?.lotId ?? null, !!first?.noLot, lot?.items.length === 1 ? lot.items[0].id : null);
    setRows((rs) => {
      const at = rs.findLastIndex((x) => x.group === group) + 1;
      return at ? [...rs.slice(0, at), r, ...rs.slice(at)] : [...rs, r];
    });
    focus(r.key, "title");
  };

  /** Selling from another lot in the same sale. */
  const addGroup = () => {
    if (rows.length >= BILL_MAX_ROWS) return;
    const r = blankRow(Math.max(...groups) + 1);
    setRows((rs) => [...rs, r]);
    focus(r.key, "source");
  };

  /** Next row's title field; grows the form (or the lot group) when Enter is pressed on its last row. */
  const goNextRow = (key: number) => {
    const i = rows.findIndex((r) => r.key === key);
    const next = rows[i + 1];
    if (next && (!selling || next.group === rows[i].group)) focus(next.key, "title");
    else addRow(rows[i].group);
  };

  const pickItem = (row: Row, o: TradeOption) => {
    patch(row.key, {
      // a lot's own item was picked: deduct from exactly that line
      ...(o.sourceId && { sourceItemId: o.sourceId, auto: false }),
      productId: o.productId,
      title: o.title,
      unitName: o.unitName ?? "",
      unitPrice: o.price === null ? row.unitPrice : String(o.price),
    });
    focus(row.key, "qty");
  };

  const setGroupSource = (group: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.group === group ? { ...r, ...p } : r)));

  const pickLot = (group: number, lot: Lot | null) => {
    const only = lot?.items.length === 1 ? lot.items[0].id : null;
    setRows((rs) =>
      rs.map((r) => {
        if (r.group !== group) return r;
        // lines already deducted from another lot's item lose that link when switching to a lot
        const keep = r.sourceItemId && (!lot || lot.items.some((i) => i.id === r.sourceItemId));
        const sourceItemId = keep ? r.sourceItemId : only;
        return { ...r, lotId: lot?.id ?? null, noLot: !lot, auto: !lot && !sourceItemId, sourceQuery: "", sourceItemId };
      }),
    );
    // selling the purchased item as it is: start the first line from the same item; it can be changed to the part sold
    const first = rows.find((r) => r.group === group)!;
    if (lot?.items.length === 1 && !first.title) patch(first.key, { title: lot.items[0].title, unitName: lot.items[0].unitName ?? "" });
    focus(first.key, "title");
  };

  /** Deduct a line from a purchase line; an empty line starts as that item. */
  const pickSource = (r: Row, s: SourceOption | undefined, auto = false) =>
    patch(r.key, { sourceItemId: s?.id ?? null, auto: !s && auto, ...(s && !r.title.trim() && { title: s.title, unitName: s.unitName ?? "", productId: null }) });

  const removeRow = (key: number) =>
    setRows((rs) => {
      const gone = rs.find((r) => r.key === key)!;
      const left = rs.filter((r) => r.key !== key);
      if (!selling) return left.length >= minRows ? left : [...left, blankRow()];
      // keep the lot group alive with an empty line while it is the only group
      if (left.some((r) => r.group === gone.group) || left.length) return left;
      return [blankRow(gone.group, gone.lotId ?? null, !!gone.noLot)];
    });

  async function submit(issueBill: boolean) {
    setError(undefined);
    const used = rows.filter((r) => r.title.trim() || r.qty || r.unitPrice);
    for (const r of used) {
      const n = rows.indexOf(r) + 1;
      if (selling && !r.lotId && !r.noLot) return setError(`แถวที่ ${n}: กรุณาเลือกว่าขายจาก LOT ไหน หรือ "ไม่ระบุ LOT"`);
      if (selling && r.lotId && !r.sourceItemId) return setError(`แถวที่ ${n}: กรุณาเลือกว่าขายจากของชิ้นไหนใน LOT (หักทุนจาก)`);
      if (!r.title.trim()) return setError(`แถวที่ ${n}: กรุณากรอกชื่อรายการ`);
      if (!(num(r.qty) > 0)) return setError(`แถวที่ ${n}: กรุณากรอกจำนวน`);
      if (!Number.isFinite(num(r.unitPrice))) return setError(`แถวที่ ${n}: กรุณากรอก${text.price}`);
    }
    if (!used.length) return setError("กรุณาเพิ่มอย่างน้อย 1 รายการ");
    setSaving(issueBill ? "bill" : "save");
    const line = (r: Row) => ({
      productId: r.productId,
      title: r.title,
      unitName: r.unitName.trim() || null,
      qty: num(r.qty),
      unitPrice: num(r.unitPrice),
    });
    const common = { id: initial.id, party, paymentMethod: head.paymentMethod, note: head.note, slipImageIds: slips };
    const res = selling
      ? await saveSale({
          ...common,
          billImageIds: billImages,
          saleDate: head.date,
          closeLotIds: closeLots.filter((id) => rows.some((r) => r.lotId === id)),
          items: used.map((r) => ({ ...line(r), sourceItemId: r.sourceItemId, auto: !!r.noLot && !!r.auto && !r.sourceItemId })),
        })
      : await saveBill({
          ...common,
          billDate: head.date,
          lotNote: head.lotNote,
          issueBill,
          items: used.map((r) => ({ ...line(r), id: r.itemId })),
        });
    if (!res.ok) {
      setSaving(null);
      return setError(res.error);
    }
    router.push(`/${selling ? "sales" : "bills"}/${res.data!.id}?fresh=1`);
  }

  /** One line: item, quantity, unit, price, amount. */
  const renderRow = (r: Row, i: number) => (
    <div key={r.key} className="py-2.5 sm:py-1.5">
      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_2.25rem] items-center gap-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_5.5rem_7.5rem_8rem_2.25rem]">
        <span className="text-center text-sm text-slate-400 tabular-nums">{i + 1}</span>
        <ItemPicker
          inputRef={reg(r.key, "title")}
          value={r.title}
          linked={r.productId !== null || (!!r.sourceItemId && sourceById.get(r.sourceItemId)?.title === r.title)}
          options={rowOptions(r)}
          placeholder={selling ? "รายการที่ขาย เช่น ทองแดง" : "ค้นหาหรือพิมพ์รายการ"}
          onType={(title) => patch(r.key, { title, productId: null })}
          onPick={(o) => pickItem(r, o)}
          right={(o) =>
            o.sourceId ? (
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">ของใน LOT</span>
            ) : o.price !== null && (
              <span className="text-sm font-semibold text-brand-700 tabular-nums">
                {fmtPrice(o.price)}
                {o.unitName && <span className="text-xs font-normal text-slate-400">/{o.unitName}</span>}
              </span>
            )
          }
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
            className={cn(inputCls, "text-right")}
          />
          <select
            value={r.unitName}
            onChange={(e) => patch(r.key, { unitName: e.target.value })}
            aria-label={`หน่วย แถวที่ ${i + 1}`}
            className={cn(inputCls, "bg-white px-1.5", !r.unitName && "text-slate-400")}
          >
            <option value="">หน่วย</option>
            {(r.unitName && !units.includes(r.unitName) ? [r.unitName, ...units] : units).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <PriceInput
            ref={reg(r.key, "price")}
            value={r.unitPrice}
            onValueChange={(unitPrice) => patch(r.key, { unitPrice })}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), goNextRow(r.key))}
            placeholder="ราคา/หน่วย"
            aria-label={`${text.price} แถวที่ ${i + 1}`}
            className={cn(inputCls, "text-right")}
          />
          <div className="col-span-3 flex items-center justify-end gap-2 text-sm sm:col-span-1">
            <span className="text-xs text-slate-400 sm:hidden">ราคารวม</span>
            <span className={cn("font-semibold tabular-nums", amountOf(r) ? "text-ink-900" : "text-slate-300")}>{fmtMoney(amountOf(r))}</span>
          </div>
        </div>
      </div>
      {selling && (r.lotId || r.noLot) && renderSource(r, i)}
    </div>
  );

  /** Selling: which purchase line (and so which lot) the row is deducted from, and what saving would do to it. */
  const renderSource = (r: Row, i: number) => {
    const lot = r.lotId ? lots.get(r.lotId) : undefined;
    const src = r.sourceItemId ? sourceById.get(r.sourceItemId) : undefined;
    const parts = plan[i] ?? [];
    const opt = (s: SourceOption) => (
      <option key={s.id} value={s.id}>
        {s.title} · เหลือ {fmtQty(s.qtyLeft)} {s.unitName ?? ""} · ทุนเหลือ {fmtMoney(s.remaining)}
      </option>
    );
    const auto = !!r.noLot && !!r.auto && !src;
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[2.25rem] text-xs sm:pl-[3rem]">
        <span className="shrink-0 text-slate-500">หักทุนจาก</span>
        <select
          value={src ? src.id : auto ? "auto" : ""}
          onChange={(e) => (e.target.value === "auto" ? pickSource(r, undefined, true) : pickSource(r, sourceById.get(Number(e.target.value))))}
          aria-label={`หักทุนจาก แถวที่ ${i + 1}`}
          className={cn(
            "h-8 max-w-full min-w-0 flex-1 rounded-lg border bg-white px-1.5 text-xs outline-none focus:border-brand-500 sm:max-w-md sm:flex-none",
            src || auto ? "border-brand-200 font-medium text-ink-900" : lot ? "border-amber-300 text-amber-700" : "border-slate-200 text-slate-500",
          )}
        >
          {lot ? (
            <>
              <option value="">— เลือกของใน LOT นี้ —</option>
              {lot.items.map(opt)}
            </>
          ) : (
            <>
              <option value="auto">อัตโนมัติ — หา LOT จากสินค้า (LOT เก่าก่อน)</option>
              <option value="">ไม่ผูก LOT (ไม่หักทุน LOT ใด)</option>
              {[...lots.values()].map((l) => (
                <optgroup key={l.id} label={[l.lotNo, l.customerName].filter(Boolean).join(" · ")}>
                  {l.items.map(opt)}
                </optgroup>
              ))}
            </>
          )}
        </select>
        {r.title.trim() && amountOf(r) > 0 && (
          <span className="basis-full text-slate-500 sm:basis-auto">
            {parts.length === 0 ? (
              auto || r.noLot ? (
                <>ไม่พบสินค้านี้ใน LOT ใด → <b className="text-slate-700">ขายไม่ผูก LOT</b> (นับเข้ากำไร/ขาดทุนรวม)</>
              ) : null
            ) : (
              parts.map((p, k) => {
                const s = sourceById.get(p.sourceId)!;
                const costAfter = Math.round((s.remaining - (usedBySource.get(s.id) ?? 0)) * 100) / 100;
                const qtyAfter = Math.round((s.qtyLeft - (qtyBySource.get(s.id) ?? 0)) * 1000) / 1000;
                return (
                  <span key={p.sourceId} className="block sm:inline">
                    {k > 0 && <span className="hidden sm:inline"> · </span>}
                    {(r.noLot || parts.length > 1) && <span className="font-medium text-slate-600 tabular-nums">{s.lotNo} </span>}
                    {p.qty !== null && (
                      <span className="tabular-nums">
                        {fmtQty(p.qty)} {s.unitName} ({qtyAfter < 0 ? `เกินที่ซื้อ ${fmtQty(-qtyAfter)}` : `เหลือ ${fmtQty(qtyAfter)}`}) ·{" "}
                      </span>
                    )}
                    ทุนเหลือ{" "}
                    {costAfter >= 0 ? <b className="text-slate-700 tabular-nums">{fmtMoney(costAfter)}</b> : <b className="text-up">คืนทุนแล้ว +{fmtMoney(-costAfter)}</b>}
                  </span>
                );
              })
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button type="button" variant="secondary" onClick={() => setPreview(true)}>
            <Eye className="size-4" /> ดูตัวอย่าง{selling ? "ใบขาย" : "บิล"} A5
          </Button>
        }
      />
      <Card className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_12rem_12rem]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="party">{text.party}</Label>
          <ItemPicker
            id="party"
            icon={UserRound}
            value={party.name}
            linked={customers.some((c) => c.name === party.name.trim())}
            options={customerOptions}
            placeholder="พิมพ์ชื่อ หรือเลือกลูกค้าเดิม (ไม่บังคับ)"
            emptyText="ชื่อใหม่ — บันทึกเป็นลูกค้าใหม่ให้อัตโนมัติ"
            keepQuery
            onType={(name) => setParty({ ...party, name })}
            onPick={(o) =>
              setParty({ name: o.customer.name, phone: o.customer.phone ?? "", bankName: o.customer.bankName ?? "", bankAccount: o.customer.bankAccount ?? "" })
            }
          />
        </div>
        <div>
          <Label htmlFor="phone">เบอร์โทร</Label>
          <Input id="phone" type="tel" value={party.phone} maxLength={40} placeholder="ไม่บังคับ" onChange={(e) => setParty({ ...party, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="date" required>วันที่</Label>
          <Input id="date" type="date" value={head.date} onChange={(e) => setHead({ ...head, date: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-[12rem_1fr]">
          <div>
            <Label htmlFor="bankName">ธนาคาร</Label>
            <Input id="bankName" value={party.bankName} maxLength={60} placeholder="เช่น กสิกร" onChange={(e) => setParty({ ...party, bankName: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="bankAccount">เลขที่บัญชี</Label>
            <Input
              id="bankAccount"
              inputMode="numeric"
              value={party.bankAccount}
              maxLength={40}
              placeholder="บันทึกไว้กับลูกค้า ใช้ตอนโอนครั้งต่อไป"
              onChange={(e) => setParty({ ...party, bankAccount: e.target.value })}
            />
          </div>
        </div>
        {!selling && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-[1fr_16rem]">
            <div>
              <Label htmlFor="lotNote">Note ของ LOT (ภายในร้าน ไม่พิมพ์ในบิล)</Label>
              <Input
                id="lotNote"
                value={head.lotNote}
                maxLength={500}
                placeholder="เช่น ตู้เย็นจากโกดังลุงชัย รอแกะ"
                onChange={(e) => setHead({ ...head, lotNote: e.target.value })}
              />
            </div>
            <div>
              <Label>LOT Number</Label>
              <div className="flex h-10 items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-500 ring-1 ring-slate-200">
                {initial.lotNo ? <span className="font-semibold text-ink-900 tabular-nums">{initial.lotNo}</span> : "สร้างอัตโนมัติเมื่อบันทึก"}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="mb-2 hidden grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_5.5rem_7.5rem_8rem_2.25rem] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
          <span className="text-center">ลำดับ</span>
          <span>{selling ? "รายการที่ขาย" : "รายการ"}</span>
          <span className="text-right">จำนวน</span>
          <span>หน่วย</span>
          <span className="text-right">{text.price}</span>
          <span className="text-right">ราคารวม</span>
          <span />
        </div>
        {selling ? (
          <div className="space-y-3">
            {groups.map((g, gi) => {
              const groupRows = rows.filter((r) => r.group === g);
              const first = groupRows[0];
              const lot = first.lotId ? lots.get(first.lotId) : undefined;
              const lotUsed = lot ? lot.items.reduce((s, it) => s + (usedBySource.get(it.id) ?? 0), 0) : 0;
              const after = lot ? Math.round((lot.remaining - lotUsed) * 100) / 100 : 0;
              return (
                <div key={g} className="rounded-xl bg-slate-50/70 p-2 ring-1 ring-slate-200 sm:p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="shrink-0 rounded-md bg-ink-900 px-2 py-0.5 text-xs font-semibold text-white">LOT {gi + 1}</span>
                    <div className="min-w-60 flex-1">
                      <ItemPicker
                        icon={Package}
                        inputRef={reg(first.key, "source")}
                        value={lot ? [lot.lotNo, lot.customerName].filter(Boolean).join(" · ") : first.noLot ? "ไม่ระบุ LOT" : (first.sourceQuery ?? "")}
                        linked={!!lot || !!first.noLot}
                        options={lotOptions}
                        placeholder="เลือก LOT — ค้นหาเลข LOT, note, ของในล็อต"
                        emptyText="ไม่พบ LOT ที่ยังเปิดอยู่"
                        onType={(q) => setGroupSource(g, { lotId: null, noLot: false, sourceItemId: null, sourceQuery: q })}
                        onPick={(o) => pickLot(g, o.lot)}
                        right={(o) =>
                          o.lot && (
                            <span className="text-right text-xs text-slate-500">
                              ทุนคงเหลือ
                              <span className="block text-sm font-semibold text-brand-700 tabular-nums">{fmtMoney(o.lot.remaining)}</span>
                            </span>
                          )
                        }
                      />
                    </div>
                  </div>
                  {lot && (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
                      <span>
                        {lot.items.length} รายการใน LOT · ทุนคงเหลือ {fmtMoney(lot.remaining)} → หลังบันทึก{" "}
                        {after >= 0 ? <b className="text-slate-700 tabular-nums">{fmtMoney(after)}</b> : <b className="text-up">คืนทุนแล้ว กำไร +{fmtMoney(-after)}</b>}
                      </span>
                      <label className="flex cursor-pointer items-center gap-1.5 font-medium text-slate-700">
                        <input
                          type="checkbox"
                          className="size-4 accent-brand-600"
                          checked={closeLots.includes(lot.id)}
                          onChange={(e) => setCloseLots((c) => (e.target.checked ? [...c, lot.id] : c.filter((x) => x !== lot.id)))}
                        />
                        ขายหมดแล้ว ปิด LOT นี้เมื่อบันทึก
                      </label>
                    </div>
                  )}
                  {first.noLot && (
                    <p className="mt-1.5 px-1 text-xs text-slate-500">
                      เลือกหรือพิมพ์สินค้า ระบบหา LOT ที่มีสินค้านั้นให้ เก่าก่อน แบ่งหักหลาย LOT ตามจำนวนที่เหลือ (เปลี่ยนได้ที่ “หักทุนจาก”) · ไม่อยู่ใน LOT ใด = ขายไม่ผูก LOT นับเข้ากำไร/ขาดทุนรวม
                    </p>
                  )}
                  <div className="mt-2 divide-y divide-slate-200/70 rounded-lg bg-white px-2 ring-1 ring-slate-100">
                    {groupRows.map((r) => renderRow(r, rows.indexOf(r)))}
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="mt-1.5 text-brand-700" onClick={() => addRow(g)} disabled={rows.length >= BILL_MAX_ROWS}>
                    <Plus className="size-4" /> เพิ่มรายการใน LOT นี้
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">{rows.map((r, i) => renderRow(r, i))}</div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {selling ? (
            <Button type="button" variant="secondary" onClick={addGroup} disabled={rows.length >= BILL_MAX_ROWS}>
              <Package className="size-4" /> ขายจาก LOT อื่นเพิ่ม
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => addRow()} disabled={rows.length >= BILL_MAX_ROWS}>
              <Plus className="size-4" /> เพิ่มแถว
            </Button>
          )}
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
            {!selling && head.paymentMethod === "transfer" && (
              <p className={cn("mt-2 text-sm", party.bankAccount ? "text-slate-600" : "text-amber-600")}>
                {party.bankAccount ? `โอนเข้า ${party.bankName} ${party.bankAccount}` : "ยังไม่มีเลขที่บัญชีลูกค้า — กรอกด้านบนเพื่อพิมพ์ลงบิล"}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="note">หมายเหตุ</Label>
            <Input id="note" value={head.note} maxLength={500} placeholder="ไม่บังคับ" onChange={(e) => setHead({ ...head, note: e.target.value })} />
          </div>
          {selling && (
            <div>
              <Label>บิล / ใบรับของจากผู้ซื้อ</Label>
              <SlipField value={billImages} onChange={setBillImages} addLabel="แนบบิล" />
            </div>
          )}
          <div>
            <Label>สลิป / หลักฐานการ{selling ? "รับเงิน" : "จ่ายเงิน"}</Label>
            <SlipField value={slips} onChange={setSlips} />
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-xl bg-ink-900 p-5 text-white lg:min-w-80">
          <div>
            <div className="text-sm text-brand-200">รวมทั้งหมด</div>
            <div className="text-4xl font-bold tabular-nums">
              {fmtMoney(total)} <span className="text-base font-normal text-white/60">บาท</span>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => setPreview(true)} className="w-full">
            <Eye className="size-4" /> ดูตัวอย่าง{selling ? "ใบขาย" : "บิล"} A5
          </Button>
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
      {preview && (
        <DocPreview
          settings={settings}
          onClose={() => setPreview(false)}
          doc={{
            kind: mode,
            no: selling ? (initial.id ? fmtSaleNo(initial.id) : null) : initial.billNo ? fmtBillNo(initial.billNo) : null,
            lotNo: initial.lotNo,
            party: party.name || null,
            date: new Date(`${head.date}T12:00:00+07:00`).toISOString(),
            paymentMethod: head.paymentMethod,
            total,
            note: head.note || null,
            bankLine: selling
              ? settings.bank_account && `โอนเข้าบัญชีร้าน ${settings.bank_name} ${settings.bank_account}${settings.bank_account_name ? ` (${settings.bank_account_name})` : ""}`
              : party.bankAccount && `โอนเข้า ${party.bankName} ${party.bankAccount}`,
            items: rows
              .filter((r) => r.title.trim())
              .map((r) => ({ title: r.title, unitName: r.unitName || null, qty: num(r.qty) || 0, unitPrice: num(r.unitPrice) || 0, amount: amountOf(r) })),
          }}
        />
      )}
    </div>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Text field with a searchable list (autocomplete). Free text stays allowed; picking fills the rest of the line. */
export function ItemPicker<T extends { key: string; title: string; group: string }>({
  id,
  value,
  linked,
  options,
  placeholder,
  emptyText,
  icon: Icon = Search,
  inputRef,
  onType,
  onPick,
  right,
  keepQuery = false,
}: {
  id?: string;
  value: string;
  linked: boolean;
  options: T[];
  placeholder: string;
  emptyText?: string;
  icon?: typeof Search;
  inputRef?: (el: HTMLInputElement | null) => void;
  onType: (v: string) => void;
  onPick: (o: T) => void;
  right?: (o: T) => React.ReactNode;
  /** keep filtering by the typed text even when it matches an option (names typed in full) */
  keepQuery?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // once an item is chosen show the whole list again, not just that one match
  const query = linked && !keepQuery ? "" : value;
  const matches = useMemo(() => {
    const q = norm(query);
    const list = q ? options.filter((o) => norm(`${o.title} ${o.group}`).includes(q)) : options;
    return list.slice(0, 50);
  }, [query, options]);

  const choose = (o: T) => {
    setOpen(false);
    onPick(o);
  };

  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-300" />
      <input
        id={id}
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
          "h-10 w-full truncate rounded-lg border bg-white pr-2.5 pl-8 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15",
          linked ? "border-brand-200 bg-brand-50/40 font-medium" : "border-slate-200",
        )}
      />
      {open && (matches.length > 0 || (emptyText && value)) && (
        <ul id={listId} role="listbox" className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl sm:right-auto sm:min-w-96">
          {matches.length === 0 && <li className="px-3 py-3 text-sm text-slate-400">{emptyText}</li>}
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
                {right && <span className="shrink-0">{right(o)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
