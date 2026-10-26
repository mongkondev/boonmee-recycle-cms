"use client";

import { LoaderCircle, Plus, Scissors, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PriceInput } from "@/components/price-input";
import { ItemPicker, type TradeOption } from "@/components/trade-form";
import { Button, Card, cn, FormError, Input, Label, Select } from "@/components/ui";
import { fmtMoney, fmtQty } from "@/lib/bill";
import { saveDismantle } from "@/lib/trade-actions";

type Part = { key: number; productId: number | null; title: string; unitName: string; qty: string; cost: string };

let nextKey = 0;
const blankPart = (): Part => ({ key: nextKey++, productId: null, title: "", unitName: "", qty: "", cost: "" });
const num = (s: string) => (s === "" || s === "." ? NaN : Number(s));
const round2 = (n: number) => Math.round(n * 100) / 100;

export function DismantleForm({ stock, products, initialKey, today }: { stock: TradeOption[]; products: TradeOption[]; initialKey: string; today: string }) {
  const router = useRouter();
  const [sourceKey, setSourceKey] = useState(stock.some((s) => s.key === initialKey) ? initialKey : "");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [parts, setParts] = useState<Part[]>(() => [blankPart(), blankPart(), blankPart()]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const src = stock.find((s) => s.key === sourceKey);
  const sourceCost = src && num(qty) > 0 ? round2(num(qty) * (src.avgCost ?? 0)) : 0;
  const used = parts.filter((p) => p.title.trim() || p.qty || p.cost);
  // parts without a typed cost share whatever cost is left, evenly
  const typedCost = used.reduce((s, p) => s + (Number.isFinite(num(p.cost)) ? num(p.cost) : 0), 0);
  const autoCount = used.filter((p) => !Number.isFinite(num(p.cost))).length;
  const autoCost = autoCount ? Math.max(0, round2((sourceCost - typedCost) / autoCount)) : 0;
  const costOf = (p: Part) => (Number.isFinite(num(p.cost)) ? num(p.cost) : autoCost);
  const partsCost = round2(used.reduce((s, p) => s + costOf(p), 0));

  const patch = (key: number, p: Partial<Part>) => setParts((ps) => ps.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function submit() {
    setError(undefined);
    if (!src) return setError("กรุณาเลือกรายการที่จะแยก");
    if (!(num(qty) > 0)) return setError("กรุณากรอกจำนวนที่แยก");
    if (num(qty) > (src.remaining ?? 0) + 1e-9) return setError(`"${src.title}" เหลือ ${fmtQty(src.remaining ?? 0)} ${src.unitName ?? ""}`);
    for (const p of used) {
      if (!p.title.trim()) return setError("กรุณากรอกชื่อชิ้นส่วนให้ครบ");
      if (!(num(p.qty) > 0)) return setError(`"${p.title}": กรุณากรอกจำนวน`);
    }
    if (!used.length) return setError("กรุณาเพิ่มชิ้นส่วนอย่างน้อย 1 รายการ");
    setSaving(true);
    const res = await saveDismantle({
      sourceKey,
      qty: num(qty),
      adjDate: date,
      note,
      items: used.map((p) => ({ productId: p.productId, title: p.title, unitName: p.unitName.trim() || null, qty: num(p.qty), cost: costOf(p) })),
    });
    if (!res.ok) {
      setSaving(false);
      return setError(res.error);
    }
    router.push("/stock");
  }

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 p-4 sm:grid-cols-[1fr_10rem_12rem] sm:p-5">
        <div>
          <Label htmlFor="src" required>ของที่จะแยก (จากสต็อก)</Label>
          <Select id="src" value={sourceKey} onChange={(e) => setSourceKey(e.target.value)}>
            <option value="">— เลือกรายการ —</option>
            {stock.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title} · เหลือ {fmtQty(s.remaining ?? 0)} {s.unitName ?? ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="qty" required>จำนวนที่แยก {src?.unitName && `(${src.unitName})`}</Label>
          <PriceInput
            id="qty"
            value={qty}
            onValueChange={setQty}
            placeholder={src ? `สูงสุด ${fmtQty(src.remaining ?? 0)}` : ""}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
        </div>
        <div>
          <Label htmlFor="date" required>วันที่</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {src && (
          <p className="text-sm text-slate-500 sm:col-span-3">
            ทุนเฉลี่ย {fmtMoney(src.avgCost ?? 0)} บาท/{src.unitName ?? "หน่วย"} → ทุนที่ย้ายไปชิ้นส่วน <b className="text-ink-900 tabular-nums">{fmtMoney(sourceCost)}</b> บาท
          </p>
        )}
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="mb-2 px-1 text-sm font-semibold text-ink-900">ชิ้นส่วนที่ได้</div>
        <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_8rem_2.25rem] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
          <span>ชิ้นส่วน</span>
          <span className="text-right">จำนวน</span>
          <span>หน่วย</span>
          <span className="text-right">ทุน (บาท)</span>
          <span />
        </div>
        <div className="divide-y divide-slate-100 sm:divide-y-0">
          {parts.map((p, i) => (
            <div key={p.key} className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_8rem_2.25rem] sm:py-1">
              <ItemPicker
                inputRef={() => {}}
                value={p.title}
                linked={p.productId !== null}
                options={products}
                placeholder="ค้นหาหรือพิมพ์ชื่อชิ้นส่วน"
                selling={false}
                onType={(title) => patch(p.key, { title, productId: null })}
                onPick={(o) => patch(p.key, { productId: o.productId, title: o.title, unitName: o.unitName ?? "" })}
              />
              <button
                type="button"
                onClick={() => setParts((ps) => (ps.length > 1 ? ps.filter((x) => x.key !== p.key) : [blankPart()]))}
                className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-accent-50 hover:text-accent-500 sm:order-last"
                aria-label={`ลบชิ้นส่วนแถวที่ ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
              <div className="col-span-2 grid grid-cols-[1fr_4.5rem_1fr] gap-2 sm:contents">
                <PriceInput
                  value={p.qty}
                  onValueChange={(v) => patch(p.key, { qty: v })}
                  placeholder="จำนวน"
                  aria-label={`จำนวนชิ้นส่วน แถวที่ ${i + 1}`}
                  className="h-10 w-full rounded-lg border border-slate-200 px-2.5 text-right text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                />
                <input
                  value={p.unitName}
                  maxLength={40}
                  onChange={(e) => patch(p.key, { unitName: e.target.value })}
                  placeholder="หน่วย"
                  aria-label={`หน่วยชิ้นส่วน แถวที่ ${i + 1}`}
                  className="h-10 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                />
                <PriceInput
                  value={p.cost}
                  onValueChange={(v) => patch(p.key, { cost: v })}
                  placeholder={p.title || p.qty ? `≈ ${fmtMoney(autoCost)}` : "ทุน"}
                  aria-label={`ทุนชิ้นส่วน แถวที่ ${i + 1}`}
                  className="h-10 w-full rounded-lg border border-slate-200 px-2.5 text-right text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="secondary" onClick={() => setParts((ps) => [...ps, blankPart()])}>
            <Plus className="size-4" /> เพิ่มชิ้นส่วน
          </Button>
          <span className={cn("text-sm tabular-nums", src && Math.abs(partsCost - sourceCost) > 0.01 ? "text-amber-600" : "text-slate-500")}>
            ทุนชิ้นส่วนรวม {fmtMoney(partsCost)} / {fmtMoney(sourceCost)} บาท
          </span>
        </div>
        <p className="mt-2 px-1 text-xs text-slate-400">เว้นช่องทุนว่างไว้ ระบบแบ่งทุนที่เหลือให้เท่าๆ กัน</p>
      </Card>

      <Card className="flex flex-wrap items-end gap-4 p-4 sm:p-5">
        <div className="min-w-60 flex-1">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Input id="note" value={note} maxLength={500} placeholder="ไม่บังคับ" onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={saving} className="h-12 px-6 text-base">
          {saving ? <LoaderCircle className="size-5 animate-spin" /> : <Scissors className="size-5" />} บันทึกการแยกชิ้นส่วน
        </Button>
      </Card>
      <FormError message={error} />
    </div>
  );
}
