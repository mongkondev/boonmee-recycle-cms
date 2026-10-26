import Link from "next/link";
import { BuySellChart } from "@/components/buy-sell-chart";
import { Card, cn, PageHeader } from "@/components/ui";
import { addDays, bangkokToday, fmtMoney, fmtQty, monthStart, weekStart } from "@/lib/bill";
import { getDaily, getItemReport, getTotals } from "@/lib/trade-queries";

export const metadata = { title: "รายงานซื้อ-ขาย" };

const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const thDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
const thMonth = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" });

function presets(today: string) {
  const lastMonthEnd = addDays(monthStart(today), -1);
  return [
    { label: "วันนี้", from: today, to: today },
    { label: "เมื่อวาน", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "สัปดาห์นี้", from: weekStart(today), to: today },
    { label: "7 วันล่าสุด", from: addDays(today, -6), to: today },
    { label: "เดือนนี้", from: monthStart(today), to: today },
    { label: "เดือนที่แล้ว", from: monthStart(lastMonthEnd), to: lastMonthEnd },
    { label: "30 วันล่าสุด", from: addDays(today, -29), to: today },
    { label: "ปีนี้", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const today = bangkokToday();
  let from = isDay(sp.from) ? sp.from! : monthStart(today);
  let to = isDay(sp.to) ? sp.to! : today;
  if (from > to) [from, to] = [to, from];
  const range = { from, to };
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

  const [totals, daily, items] = await Promise.all([getTotals(range), getDaily(from, to), getItemReport(range)]);
  // long ranges read better month by month
  const byMonth = days > 62;
  const periods = byMonth
    ? Object.values(
        daily.reduce<Record<string, { label: string; buy: number; sell: number }>>((acc, d) => {
          const m = d.day.slice(0, 7);
          acc[m] ??= { label: thMonth(m), buy: 0, sell: 0 };
          acc[m].buy += d.buy;
          acc[m].sell += d.sell;
          return acc;
        }, {}),
      )
    : daily.map((d) => ({ label: thDay(d.day), buy: d.buy, sell: d.sell }));
  const active = periods.filter((p) => p.buy || p.sell).reverse();

  return (
    <>
      <PageHeader title="รายงานซื้อเข้า-ขายออก" description={`${thDay(from)} – ${thDay(to)} · ${days} วัน`} />

      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {presets(today).map((p) => {
            const on = p.from === from && p.to === to;
            return (
              <Link
                key={p.label}
                href={`/reports?from=${p.from}&to=${p.to}`}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm ring-1 transition",
                  on ? "bg-ink-900 font-medium text-white ring-ink-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">
            ตั้งแต่
            <input type="date" name="from" defaultValue={from} className="mt-1 block h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm" />
          </label>
          <label className="text-xs text-slate-500">
            ถึง
            <input type="date" name="to" defaultValue={to} className="mt-1 block h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm" />
          </label>
          <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">ดูรายงาน</button>
        </form>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ซื้อเข้า" value={totals.buyAmount} sub={`${totals.buyCount} รายการ · เงินสด ${fmtMoney(totals.buyCash)} · โอน ${fmtMoney(totals.buyAmount - totals.buyCash)}`} />
        <Stat label="ขายออก / รายรับ" value={totals.sellAmount} sub={`${totals.sellCount} รายการ`} />
        <Stat
          label="กำไรจาก LOT ที่ปิดในช่วงนี้"
          value={totals.closedProfit}
          sub={`${totals.closedCount} LOT · ยอดขาย − ทุนของ LOT`}
          tone={totals.closedProfit < 0 ? "bad" : undefined}
        />
        <Stat label="เงินสุทธิ (ขาย − ซื้อ)" value={totals.sellAmount - totals.buyAmount} sub="กระแสเงินในช่วงนี้" tone={totals.sellAmount - totals.buyAmount < 0 ? "bad" : undefined} />
      </div>

      {days <= 62 && (
        <Card className="mb-5 p-4">
          <BuySellChart data={daily} />
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink-900">{byMonth ? "รายเดือน" : "รายวัน"}</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">{byMonth ? "เดือน" : "วันที่"}</th>
                <th className="px-3 py-2 text-right">ซื้อเข้า</th>
                <th className="px-3 py-2 text-right">ขายออก</th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">สุทธิ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {active.length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400">ไม่มีรายการในช่วงนี้</td></tr>
              )}
              {active.map((p) => (
                <tr key={p.label}>
                  <td className="px-4 py-2 whitespace-nowrap">{p.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(p.buy)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(p.sell)}</td>
                  <td className={cn("hidden px-4 py-2 text-right tabular-nums sm:table-cell", p.sell - p.buy < 0 && "text-accent-600")}>
                    {fmtMoney(p.sell - p.buy)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {active.length < periods.length && active.length > 0 && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">ซ่อน{byMonth ? "เดือน" : "วัน"}ที่ไม่มีรายการ {periods.length - active.length} {byMonth ? "เดือน" : "วัน"}</p>
          )}
        </Card>

        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink-900">แยกตามรายการ</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">รายการ</th>
                <th className="px-3 py-2 text-right">ซื้อเข้า</th>
                <th className="px-4 py-2 text-right">ขายออก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr><td colSpan={3} className="py-10 text-center text-slate-400">ไม่มีรายการในช่วงนี้</td></tr>
              )}
              {items.map((i) => (
                <tr key={i.key}>
                  <td className="px-4 py-2 font-medium text-slate-800">{i.title}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {i.buyQty ? (
                      <>
                        {fmtMoney(i.buyAmount)}
                        <div className="text-xs text-slate-400">{fmtQty(i.buyQty)} {i.unitName}</div>
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {i.sellQty ? (
                      <>
                        {fmtMoney(i.sellAmount)}
                        <div className="text-xs text-slate-400">{fmtQty(i.sellQty)} {i.unitName}</div>
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "bad" }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums", tone === "bad" ? "text-accent-600" : "text-ink-900")}>
        {fmtMoney(value)} <span className="text-sm font-normal text-slate-400">บาท</span>
      </div>
      <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
    </Card>
  );
}
