import Link from "next/link";
import { fmtMoney } from "@/lib/bill";
import type { LotSummary } from "@/lib/trade-queries";
import { cn } from "./ui";

const thDay = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

/** LOT ซื้อเข้า / ขายไป / ทุนคงเหลือ (โดยประมาณ). */
export function LotTable({ lots, empty }: { lots: LotSummary[]; empty: string }) {
  const sum = lots.reduce((s, l) => ({ cost: s.cost + l.cost, sold: s.sold + l.sold, remaining: s.remaining + l.remaining }), { cost: 0, sold: 0, remaining: 0 });
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
        <tr>
          <th className="px-4 py-2.5">LOT</th>
          <th className="hidden px-3 py-2.5 text-right sm:table-cell">ซื้อเข้า</th>
          <th className="hidden px-3 py-2.5 text-right sm:table-cell">ขายไป</th>
          <th className="px-4 py-2.5 text-right">คงเหลือ (ประมาณ)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {lots.length === 0 && (
          <tr><td colSpan={4} className="py-10 text-center text-slate-400">{empty}</td></tr>
        )}
        {lots.map((l) => {
          const pct = l.cost > 0 ? Math.min(100, (l.sold / l.cost) * 100) : 100;
          return (
            <tr key={l.id} className={cn("hover:bg-slate-50/70", l.closed && "text-slate-400")}>
              <td className="px-4 py-2.5">
                <Link href={`/lots/${l.id}`} className="font-semibold text-brand-700 tabular-nums hover:underline">{l.lotNo}</Link>
                {l.closed && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">ปิดแล้ว</span>}
                <div className="truncate text-xs text-slate-500">{[thDay(l.date), l.lotNote, l.titles].filter(Boolean).join(" · ")}</div>
                <div className="mt-1 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-slate-100" title={`ขายคืนทุนแล้ว ${Math.round(pct)}%`}>
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-400 tabular-nums sm:hidden">ซื้อ {fmtMoney(l.cost)} · ขาย {fmtMoney(l.sold)}</div>
              </td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{fmtMoney(l.cost)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{fmtMoney(l.sold)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <span className="font-semibold">{fmtMoney(l.remaining)}</span>
                {l.profit > 0 && <div className="text-xs text-up">กำไร +{fmtMoney(l.profit)}</div>}
              </td>
            </tr>
          );
        })}
      </tbody>
      {lots.length > 1 && (
        <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold tabular-nums">
          <tr>
            <td className="px-4 py-2.5 text-slate-500">รวม {lots.length} LOT</td>
            <td className="hidden px-3 py-2.5 text-right sm:table-cell">{fmtMoney(sum.cost)}</td>
            <td className="hidden px-3 py-2.5 text-right sm:table-cell">{fmtMoney(sum.sold)}</td>
            <td className="px-4 py-2.5 text-right">{fmtMoney(sum.remaining)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
