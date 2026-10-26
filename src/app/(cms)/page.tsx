import { ArrowDownToLine, ArrowUpFromLine, Boxes, ChartColumn, HandCoins, ReceiptText } from "lucide-react";
import Link from "next/link";
import { BuySellChart } from "@/components/buy-sell-chart";
import { Card, cn } from "@/components/ui";
import { addDays, bangkokToday, fmtBillNo, fmtMoney, monthStart, weekStart } from "@/lib/bill";
import { getBills } from "@/lib/queries";
import { getDaily, getSales, getStock, getTotals } from "@/lib/trade-queries";
import { fmtDate } from "@/lib/trend";

export const metadata = { title: "ภาพรวม" };

export default async function Dashboard() {
  const today = bangkokToday();
  const periods = [
    { label: "วันนี้", from: today, to: today },
    { label: "สัปดาห์นี้", from: weekStart(today), to: today },
    { label: "เดือนนี้", from: monthStart(today), to: today },
    { label: "รวมทั้งหมด", from: null, to: null },
  ];
  const [totals, daily, stock, bills, sales] = await Promise.all([
    Promise.all(periods.map((p) => getTotals(p))),
    getDaily(addDays(today, -13), today),
    getStock(),
    getBills("", 5),
    getSales("", 5),
  ]);
  const stockValue = stock.reduce((s, i) => s + Math.max(0, i.value), 0);
  const month = totals[2];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">ภาพรวมร้าน</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/bills/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-600">
            <ArrowDownToLine className="size-4" /> รับซื้อ / ออกบิล
          </Link>
          <Link href="/sales/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-ink-700">
            <ArrowUpFromLine className="size-4" /> ขายออก
          </Link>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {periods.map((p, i) => {
          const t = totals[i];
          const net = t.sellAmount - t.buyAmount;
          return (
            <Card key={p.label} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-900">{p.label}</span>
                {p.from && (
                  <Link href={`/reports?from=${p.from}&to=${p.to}`} className="text-xs text-brand-600 hover:underline">รายงาน</Link>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="size-2 rounded-sm bg-[#2a78d6]" /> ซื้อเข้า</div>
                  <div className="text-lg leading-tight font-bold text-ink-900 tabular-nums">{fmtMoney(t.buyAmount)}</div>
                  <div className="text-xs text-slate-400">{t.buyCount} รายการ</div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="size-2 rounded-sm bg-[#2f8217]" /> ขายออก</div>
                  <div className="text-lg leading-tight font-bold text-ink-900 tabular-nums">{fmtMoney(t.sellAmount)}</div>
                  <div className="text-xs text-slate-400">{t.sellCount} รายการ</div>
                </div>
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-xs">
                <span className="text-slate-500">สุทธิ (ขาย − ซื้อ)</span>
                <span className={cn("font-semibold tabular-nums", net < 0 ? "text-accent-600" : "text-slate-700")}>{fmtMoney(net)}</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ChartColumn className="size-4 text-slate-400" /> 14 วันล่าสุด
          </div>
          <BuySellChart data={daily} />
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Link href="/stock">
            <Card className="h-full p-4 transition hover:ring-2 hover:ring-brand-200">
              <div className="flex items-center gap-1.5 text-sm text-slate-500"><Boxes className="size-4" /> มูลค่าสต็อกคงเหลือ (ทุน)</div>
              <div className="text-2xl font-bold text-ink-900 tabular-nums">{fmtMoney(stockValue)}</div>
              <div className="text-xs text-slate-400">{stock.filter((s) => s.remaining > 0).length} รายการยังมีของ</div>
            </Card>
          </Link>
          <Card className="p-4">
            <div className="text-sm text-slate-500">กำไรขั้นต้นเดือนนี้ (ประมาณ)</div>
            <div className={cn("text-2xl font-bold tabular-nums", month.profit < 0 ? "text-accent-600" : "text-ink-900")}>{fmtMoney(month.profit)}</div>
            <div className="text-xs text-slate-400">ยอดขาย − ทุนเฉลี่ยของที่ขาย</div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink-900"><ReceiptText className="size-4 text-slate-400" /> รับซื้อล่าสุด</span>
            <Link href="/bills" className="text-xs text-brand-600 hover:underline">ทั้งหมด</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {bills.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">ยังไม่มีรายการ</li>}
            {bills.map((b) => (
              <li key={b.id}>
                <Link href={`/bills/${b.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">{b.customerName ?? "ไม่ระบุชื่อ"}</span>
                    <span className="block text-xs text-slate-400">
                      {b.billNo ? `บิล ${fmtBillNo(b.billNo)}` : "ยังไม่ออกบิล"} · {fmtDate(b.billDate)}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{fmtMoney(b.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink-900"><HandCoins className="size-4 text-slate-400" /> ขายออกล่าสุด</span>
            <Link href="/sales" className="text-xs text-brand-600 hover:underline">ทั้งหมด</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {sales.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">ยังไม่มีรายการ</li>}
            {sales.map((s) => (
              <li key={s.id}>
                <Link href={`/sales/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">{s.buyerName ?? "ไม่ระบุผู้ซื้อ"}</span>
                    <span className="block text-xs text-slate-400">#{s.id} · {fmtDate(s.saleDate)}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{fmtMoney(s.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
