import { Boxes, Scissors, Search } from "lucide-react";
import Link from "next/link";
import { Card, cn, PageHeader } from "@/components/ui";
import { fmtMoney, fmtQty } from "@/lib/bill";
import { getAdjustments, getStock } from "@/lib/trade-queries";
import { fmtDate } from "@/lib/trend";
import { DeleteAdjustment } from "./delete-adjustment";

export const metadata = { title: "สต็อกคงเหลือ" };

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const [stock, adjustments] = await Promise.all([getStock(), getAdjustments()]);
  const rows = stock
    .filter((s) => sp.all || s.remaining !== 0)
    .filter((s) => !q || `${s.title} ${s.group}`.toLowerCase().includes(q))
    .sort((a, b) => a.group.localeCompare(b.group, "th") || a.title.localeCompare(b.title, "th"));
  const value = stock.reduce((s, i) => s + Math.max(0, i.value), 0);
  const inStock = stock.filter((s) => s.remaining > 0).length;

  return (
    <>
      <PageHeader
        title="สต็อกคงเหลือ"
        description="ซื้อเข้า − ขายออก ± แยกชิ้นส่วน · มูลค่าคิดจากทุนเฉลี่ยของที่รับซื้อเข้า"
        actions={
          <Link href="/stock/dismantle" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-600">
            <Scissors className="size-4" /> แยกชิ้นส่วน
          </Link>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm text-slate-500">มูลค่าสต็อก (ทุน)</div>
          <div className="text-2xl font-bold text-ink-900 tabular-nums">{fmtMoney(value)} <span className="text-sm font-normal text-slate-400">บาท</span></div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-500">รายการที่ยังมีของ</div>
          <div className="text-2xl font-bold text-ink-900 tabular-nums">{inStock} <span className="text-sm font-normal text-slate-400">รายการ</span></div>
        </Card>
      </div>
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="ค้นหารายการ"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="all" value="1" defaultChecked={!!sp.all} className="size-4 accent-brand-500" /> แสดงที่ขายหมดแล้ว
        </label>
        <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">ค้นหา</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">รายการ</th>
              <th className="px-3 py-3 text-right">คงเหลือ</th>
              <th className="hidden px-3 py-3 text-right sm:table-cell">ทุนเฉลี่ย/หน่วย</th>
              <th className="px-3 py-3 text-right">มูลค่า (บาท)</th>
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center text-slate-400">
                  <Boxes className="mx-auto mb-3 size-8" />
                  {q ? "ไม่พบรายการ" : "ยังไม่มีของในสต็อก — รับซื้อเข้าจากหน้า รับซื้อเข้า / บิลเงินสด"}
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.key} className="hover:bg-slate-50/70">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800">{s.title}</div>
                  <div className="text-xs text-slate-400">{s.group}</div>
                </td>
                <td className={cn("px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums", s.remaining < 0 ? "text-accent-600" : s.remaining === 0 && "text-slate-300")}>
                  {fmtQty(s.remaining)} <span className="text-xs font-normal text-slate-400">{s.unitName}</span>
                </td>
                <td className="hidden px-3 py-2.5 text-right text-slate-500 tabular-nums sm:table-cell">{fmtMoney(s.avgCost)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(s.value)}</td>
                <td className="px-3 py-2.5">
                  {s.remaining > 0 && (
                    <Link
                      href={`/stock/dismantle?key=${encodeURIComponent(s.key)}`}
                      title="แยกชิ้นส่วน"
                      aria-label={`แยกชิ้นส่วน ${s.title}`}
                      className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Scissors className="size-4" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {rows.some((s) => s.remaining < 0) && (
        <p className="mt-2 text-xs text-accent-600">ยอดติดลบ = ขายหรือแยกออกมากกว่าที่บันทึกรับซื้อ (เช่น แก้ไข/ลบบิลรับซื้อภายหลัง)</p>
      )}

      {adjustments.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold text-ink-900">ประวัติแยกชิ้นส่วน</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {adjustments.map((a) => {
              const src = a.items.filter((i) => i.qty < 0);
              const parts = a.items.filter((i) => i.qty > 0);
              return (
                <Card key={a.id} className="p-4 text-sm">
                  <div className="mb-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800">
                        {src.map((i) => `${i.title} ${fmtQty(-i.qty)} ${i.unitName ?? ""}`).join(", ")}
                      </div>
                      <div className="text-xs text-slate-400">
                        {fmtDate(a.adjDate)} · {a.createdBy ?? "—"}
                        {a.note && ` · ${a.note}`}
                      </div>
                    </div>
                    <DeleteAdjustment id={a.id} />
                  </div>
                  <ul className="space-y-0.5 border-l-2 border-brand-200 pl-3 text-slate-600">
                    {parts.map((i, k) => (
                      <li key={k} className="flex gap-2">
                        <span className="min-w-0 flex-1 truncate">{i.title}</span>
                        <span className="tabular-nums">{fmtQty(i.qty)} {i.unitName}</span>
                        <span className="w-24 text-right text-slate-400 tabular-nums">ทุน {fmtMoney(i.cost)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
