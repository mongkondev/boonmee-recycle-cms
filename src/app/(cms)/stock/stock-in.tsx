"use client";

import { PackagePlus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PriceInput } from "@/components/price-input";
import { ItemPicker, type TradeOption } from "@/components/trade-form";
import { Button, Card, cn, FormError, Input, Label } from "@/components/ui";
import { fmtQty } from "@/lib/bill";
import { addStockIn, deleteStockIn } from "@/lib/trade-actions";
import type { StockSource } from "@/lib/trade-queries";
import { fmtDate } from "@/lib/trend";

type Item = { key: string; productId: number | null; title: string; unitName: string | null; fromLots: number; added: number; total: number };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
/** the same item in the same unit (as the sale form counts it) */
const sameAs = (a: { productId: number | null; title: string; unitName: string | null }, b: typeof a) =>
  (a.unitName ?? "") === (b.unitName ?? "") && ((a.productId !== null && a.productId === b.productId) || norm(a.title) === norm(b.title));

/** Pick an item, see what is on hand, type what was added, save. */
export function StockIn({ products, items, history }: { products: TradeOption[]; items: Item[]; history: StockSource[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<TradeOption | null>(null);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string>();

  const onHand = useMemo(
    () => (picked ? items.filter((i) => sameAs(i, picked)).reduce((t, i) => t + i.total, 0) : 0),
    [picked, items],
  );
  const add = Number(qty) || 0;
  const options = useMemo(
    () =>
      products.map((p) => {
        const have = items.filter((i) => sameAs(i, p)).reduce((t, i) => t + i.total, 0);
        return { ...p, have };
      }),
    [products, items],
  );

  async function save() {
    setError(undefined);
    if (!picked) return setError("กรุณาเลือกสินค้า");
    if (!(add > 0)) return setError("กรุณากรอกจำนวนที่ได้เพิ่ม");
    setSaving(true);
    const res = await addStockIn({ productId: picked.productId, title: picked.title, unitName: picked.unitName, qty: add, note });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setDone(`เติม ${picked.title} ${fmtQty(add)} ${picked.unitName ?? ""} แล้ว — รวมเป็น ${fmtQty(onHand + add)} ${picked.unitName ?? ""}`);
    setPicked(null);
    setQuery("");
    setQty("");
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)]">
          <div>
            <Label htmlFor="stockItem" required>สินค้า</Label>
            <ItemPicker
              id="stockItem"
              value={picked?.title ?? query}
              linked={!!picked}
              options={options}
              placeholder="ค้นหาสินค้า เช่น ทองแดง"
              emptyText="ไม่พบสินค้า — เพิ่มได้ที่หน้า สินค้ารับซื้อ"
              onType={(q) => {
                setPicked(null);
                setQuery(q);
                setDone(undefined);
              }}
              onPick={(o) => {
                setPicked(o);
                setDone(undefined);
                setTimeout(() => document.getElementById("stockQty")?.focus(), 0);
              }}
              right={(o) => (
                <span className={cn("text-xs tabular-nums", o.have > 0 ? "font-medium text-brand-700" : "text-slate-400")}>
                  มี {fmtQty(o.have)} {o.unitName ?? ""}
                </span>
              )}
            />
          </div>
          <div>
            <Label htmlFor="stockQty" required>ได้เพิ่ม {picked?.unitName && `(${picked.unitName})`}</Label>
            <PriceInput
              id="stockQty"
              value={qty}
              onValueChange={setQty}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
              placeholder="0"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-base outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
            />
          </div>
          <div>
            <Label htmlFor="stockNote">ได้มาจาก / หมายเหตุ</Label>
            <Input id="stockNote" value={note} maxLength={300} placeholder="เช่น แกะจากทีวี LOT-…0005" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          {picked ? (
            <div className="text-base tabular-nums">
              เดิมมี <b>{fmtQty(onHand)}</b> + ได้เพิ่ม <b className="text-brand-700">{fmtQty(add)}</b> = รวม{" "}
              <b className="text-xl text-ink-900">{fmtQty(onHand + add)}</b> {picked.unitName}
            </div>
          ) : (
            <div className="text-sm text-slate-500">{done ?? "เลือกสินค้าเพื่อดูจำนวนที่มีอยู่"}</div>
          )}
          <Button onClick={save} disabled={saving || !picked} className="h-11 px-6 text-base">
            <Save className="size-5" /> บันทึกเข้าสต็อก
          </Button>
        </div>
        <FormError message={error} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink-900">ของที่มีอยู่ (LOT ที่เปิด + ที่เติม)</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">สินค้า</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">จาก LOT</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">เติมเอง</th>
                <th className="px-4 py-2 text-right">รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.filter((i) => i.total > 0).length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400">ยังไม่มีของในสต็อก</td></tr>
              )}
              {items
                .filter((i) => i.total > 0)
                .sort((a, b) => a.title.localeCompare(b.title, "th"))
                .map((i) => (
                  <tr key={i.key}>
                    <td className="px-4 py-2 font-medium text-slate-800">{i.title}</td>
                    <td className="hidden px-3 py-2 text-right text-slate-500 tabular-nums sm:table-cell">{fmtQty(Math.max(0, i.fromLots))}</td>
                    <td className="hidden px-3 py-2 text-right text-slate-500 tabular-nums sm:table-cell">{fmtQty(i.added)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {fmtQty(i.total)} <span className="text-xs font-normal text-slate-400">{i.unitName}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink-900">ประวัติการเติมสต็อก</div>
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <PackagePlus className="mx-auto mb-2 size-6" />
              ยังไม่เคยเติมสต็อก
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800">
                      {h.title} <span className="text-brand-700 tabular-nums">+{fmtQty(h.qty)} {h.unitName}</span>
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {fmtDate(h.createdAt)}
                      {h.note && ` · ${h.note}`}
                      {h.qtyLeft < h.qty && ` · ขายไปแล้ว ${fmtQty(h.qty - h.qtyLeft)}`}
                    </div>
                  </div>
                  {h.qtyLeft >= h.qty && (
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-accent-50 hover:text-accent-500"
                      aria-label={`ลบการเติม ${h.title}`}
                      onClick={async () => {
                        if (!confirm(`ลบการเติม ${h.title} ${fmtQty(h.qty)} ${h.unitName ?? ""}?`)) return;
                        const res = await deleteStockIn(h.id);
                        if (!res.ok) alert(res.error);
                        router.refresh();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
