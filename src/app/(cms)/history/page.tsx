import { FileDown } from "lucide-react";
import Link from "next/link";
import { TrendBadge } from "@/components/trend";
import { Card, PageHeader } from "@/components/ui";
import { getHistory } from "@/lib/queries";
import { fmtDate, fmtPrice } from "@/lib/trend";

export const metadata = { title: "ประวัติราคา" };

export default async function HistoryPage() {
  const rows = await getHistory();
  return (
    <>
      <PageHeader
        title="ประวัติการปรับราคา"
        description="300 รายการล่าสุด"
        actions={
          <Link href="/publications" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <FileDown className="size-4" /> ดาวน์โหลดเมนูที่เคย Publish
          </Link>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">วันเวลา</th>
              <th className="px-3 py-3">สินค้า</th>
              <th className="px-3 py-3 text-right">ราคาเดิม</th>
              <th className="px-3 py-3 text-right">ราคาใหม่</th>
              <th className="px-3 py-3">เปลี่ยนแปลง</th>
              <th className="px-4 py-3">โดย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-16 text-center text-slate-400">ยังไม่มีการปรับราคา</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500">{fmtDate(r.changedAt)}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/products/${r.productId}`} className="font-medium text-slate-800 hover:text-brand-600">{r.title}</Link>
                  <div className="text-xs text-slate-400">{r.mainName}{r.subName && ` › ${r.subName}`}</div>
                </td>
                <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{fmtPrice(r.oldPrice)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  {fmtPrice(r.newPrice)} <span className="text-xs font-normal text-slate-400">{r.unitName ? `/${r.unitName}` : ""}</span>
                </td>
                <td className="px-3 py-2.5"><TrendBadge price={r.newPrice} prev={r.oldPrice} /></td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{r.changedBy ?? "ระบบ"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
