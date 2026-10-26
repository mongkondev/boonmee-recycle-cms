import { ArrowLeft, HandCoins, ReceiptText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, cn, PageHeader } from "@/components/ui";
import { fmtMoney, fmtQty, fmtSaleNo } from "@/lib/bill";
import { getLot } from "@/lib/trade-queries";
import { fmtDate } from "@/lib/trend";
import { LotControls } from "./lot-controls";

export const metadata = { title: "LOT" };

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const lot = Number.isInteger(id) ? await getLot(id) : null;
  if (!lot) notFound();
  const pct = lot.cost > 0 ? Math.min(100, (lot.sold / lot.cost) * 100) : 100;
  return (
    <>
      <PageHeader
        title={lot.lotNo}
        description={`รับซื้อ ${fmtDate(lot.date)} · ${lot.customerName ?? "ไม่ระบุชื่อลูกค้า"}${lot.closed ? " · ปิดแล้ว" : ""}`}
        actions={
          <>
            <Link href="/lots" className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">
              <ArrowLeft className="size-4" /> LOT ทั้งหมด
            </Link>
            <Link href={`/bills/${lot.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <ReceiptText className="size-4" /> รายการรับซื้อ / บิล
            </Link>
            {!lot.closed && (
              <Link href={`/sales/new?lot=${lot.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-600">
                <HandCoins className="size-4" /> ขายจาก LOT นี้
              </Link>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-slate-500">ซื้อเข้า (ทุน)</div>
          <div className="text-2xl font-bold text-ink-900 tabular-nums">{fmtMoney(lot.cost)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-500">ขายไปแล้ว</div>
          <div className="text-2xl font-bold text-ink-900 tabular-nums">{fmtMoney(lot.sold)}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-slate-500">ทุนคงเหลือ (ประมาณ)</div>
          <div className="text-2xl font-bold text-ink-900 tabular-nums">{fmtMoney(lot.remaining)}</div>
          <div className={cn("text-xs", lot.profit > 0 ? "text-up" : "text-slate-400")}>
            {lot.profit > 0 ? `คืนทุนแล้ว กำไร +${fmtMoney(lot.profit)}` : `ต้องขายอีก ${fmtMoney(-lot.profit)} จึงคืนทุน`}
          </div>
        </Card>
      </div>

      <LotControls id={lot.id} note={lot.lotNote ?? ""} closed={lot.closed} />

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink-900">รายการที่ซื้อเข้า</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">รายการ</th>
                <th className="px-3 py-2 text-right">ทุน</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">ขายไป</th>
                <th className="px-4 py-2 text-right">คงเหลือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lot.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{i.title}</div>
                    <div className="text-xs text-slate-400">
                      ซื้อ {fmtQty(i.qty)} {i.unitName} · <span className={cn(i.qtyLeft <= 0 && "text-up")}>เหลือ {fmtQty(Math.max(0, i.qtyLeft))} {i.unitName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(i.cost)}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{fmtMoney(i.sold)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtMoney(i.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink-900">ขายออกจาก LOT นี้</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">รายการที่ขาย</th>
                <th className="hidden px-3 py-2 sm:table-cell">ใบขาย</th>
                <th className="px-4 py-2 text-right">ยอดขาย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lot.sales.length === 0 && (
                <tr><td colSpan={3} className="py-10 text-center text-slate-400">ยังไม่มีการขายจาก LOT นี้</td></tr>
              )}
              {lot.sales.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{s.title} <span className="font-normal text-slate-400">{fmtQty(s.qty)} {s.unitName}</span></div>
                    <div className="text-xs text-slate-400">จาก {s.sourceTitle} · {fmtDate(s.saleDate)}{s.auto && " · หา LOT อัตโนมัติ"}</div>
                  </td>
                  <td className="hidden px-3 py-2 text-xs sm:table-cell">
                    <Link href={`/sales/${s.saleId}`} className="font-medium text-brand-700 hover:underline">{fmtSaleNo(s.saleId)}</Link>
                    <div className="text-slate-400">{s.buyerName ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtMoney(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
