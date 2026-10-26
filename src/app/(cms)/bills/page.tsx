import { Plus, ReceiptText, Search } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { fmtBillNo, fmtMoney, PAYMENT_LABEL } from "@/lib/bill";
import { getBills } from "@/lib/queries";
import { fmtDate } from "@/lib/trend";

export const metadata = { title: "บิลรับซื้อ" };

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const bills = await getBills(q);
  const sum = bills.reduce((s, b) => s + b.total, 0);
  return (
    <>
      <PageHeader
        title="บิลเงินสดรับซื้อ"
        description="บิล A5 สำหรับส่งให้ลูกค้า เป็นรูปหรือ PDF"
        actions={
          <Link href="/bills/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-600">
            <Plus className="size-4" /> สร้างบิล
          </Link>
        }
      />
      <form className="mb-4 flex gap-2">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาเลขที่บิล ชื่อลูกค้า หรือรายการ"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
        </div>
        <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">ค้นหา</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">เลขที่</th>
              <th className="px-3 py-3">ลูกค้า</th>
              <th className="hidden px-3 py-3 md:table-cell">วันที่</th>
              <th className="hidden px-3 py-3 text-center sm:table-cell">การจ่าย</th>
              <th className="px-4 py-3 text-right">รวม (บาท)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bills.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center text-slate-400">
                  <ReceiptText className="mx-auto mb-3 size-8" />
                  {q ? "ไม่พบบิลที่ค้นหา" : "ยังไม่มีบิล — กด 'สร้างบิล' เพื่อเริ่ม"}
                </td>
              </tr>
            )}
            {bills.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2.5">
                  <Link href={`/bills/${b.id}`} className="font-semibold text-brand-700 tabular-nums hover:underline">{fmtBillNo(b.id)}</Link>
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/bills/${b.id}`} className="block">
                    <span className="font-medium text-slate-800">{b.customerName ?? "—"}</span>
                    <span className="block text-xs text-slate-400">
                      {b.itemCount} รายการ<span className="md:hidden"> · {fmtDate(b.billDate)}</span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-3 py-2.5 text-xs whitespace-nowrap text-slate-500 md:table-cell">{fmtDate(b.billDate)}</td>
                <td className="hidden px-3 py-2.5 text-center sm:table-cell">
                  <span className={b.paymentMethod === "cash" ? "rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700" : "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"}>
                    {PAYMENT_LABEL[b.paymentMethod]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtMoney(b.total)}</td>
              </tr>
            ))}
          </tbody>
          {bills.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-slate-500 md:hidden">{bills.length} บิล</td>
                <td colSpan={4} className="hidden px-4 py-3 text-slate-500 md:table-cell">{bills.length} บิล{q && ` (ค้นหา "${q}")`}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtMoney(sum)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </>
  );
}
