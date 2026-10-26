import { CheckCircle2, HandCoins, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { fmtMoney, PAYMENT_LABEL } from "@/lib/bill";
import { getSales } from "@/lib/trade-queries";
import { fmtDate } from "@/lib/trend";

export const metadata = { title: "ขายออก" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string; saved?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const sales = await getSales(q);
  const sum = sales.reduce((s, b) => s + b.total, 0);
  return (
    <>
      <PageHeader
        title="ขายออก / รายรับ"
        description="ขายของจากสต็อกที่รับซื้อเข้า ทั้งขายยกล็อตหรือแยกชิ้นส่วนขาย"
        actions={
          <Link href="/sales/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-600">
            <Plus className="size-4" /> บันทึกขายออก
          </Link>
        }
      />
      {sp.saved && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <CheckCircle2 className="size-5 shrink-0" /> บันทึกรายการขาย #{sp.saved} แล้ว — สต็อกตัดออกให้แล้ว
        </div>
      )}
      <form className="mb-4 flex gap-2">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาเลขที่ ผู้ซื้อ หรือรายการ"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
        </div>
        <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">ค้นหา</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-3 py-3">ผู้ซื้อ</th>
              <th className="hidden px-3 py-3 md:table-cell">วันที่</th>
              <th className="hidden px-3 py-3 text-center sm:table-cell">รับเงิน</th>
              <th className="px-4 py-3 text-right">รวม (บาท)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center text-slate-400">
                  <HandCoins className="mx-auto mb-3 size-8" />
                  {q ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีรายการขาย"}
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id} className={String(s.id) === sp.saved ? "bg-brand-50/60" : "hover:bg-slate-50/70"}>
                <td className="px-4 py-2.5">
                  <Link href={`/sales/${s.id}`} className="font-semibold text-brand-700 tabular-nums hover:underline">#{s.id}</Link>
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/sales/${s.id}`} className="block">
                    <span className="font-medium text-slate-800">{s.buyerName ?? "—"}</span>
                    <span className="block text-xs text-slate-400">
                      {s.itemCount} รายการ<span className="md:hidden"> · {fmtDate(s.saleDate)}</span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-3 py-2.5 text-xs whitespace-nowrap text-slate-500 md:table-cell">{fmtDate(s.saleDate)}</td>
                <td className="hidden px-3 py-2.5 text-center sm:table-cell">
                  <span className={s.paymentMethod === "cash" ? "rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700" : "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"}>
                    {PAYMENT_LABEL[s.paymentMethod]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtMoney(s.total)}</td>
              </tr>
            ))}
          </tbody>
          {sales.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-slate-500 md:hidden">{sales.length} รายการ</td>
                <td colSpan={4} className="hidden px-4 py-3 text-slate-500 md:table-cell">{sales.length} รายการ</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtMoney(sum)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </>
  );
}
