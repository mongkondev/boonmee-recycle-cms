import { Search } from "lucide-react";
import Link from "next/link";
import { LotTable } from "@/components/lot-table";
import { Card, cn, PageHeader } from "@/components/ui";
import { fmtMoney } from "@/lib/bill";
import { getLots } from "@/lib/trade-queries";

export const metadata = { title: "LOT" };

const TABS = [
  { key: "open", label: "เปิดอยู่" },
  { key: "closed", label: "ปิดแล้ว" },
  { key: "all", label: "ทั้งหมด" },
] as const;

export default async function LotsPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "open";
  const q = (sp.q ?? "").slice(0, 100);
  const lots = await getLots({ open: tab === "all" ? undefined : tab === "open", search: q });
  const remaining = lots.reduce((s, l) => s + l.remaining, 0);
  return (
    <>
      <PageHeader title="LOT รับซื้อ" description="ทุกการรับซื้อคือ 1 LOT · ขายออกหักจากทุนของ LOT เป็นเงิน · ปิด LOT เมื่อแกะขายหมดแล้ว" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/lots?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn("rounded-md px-3 py-1.5 text-sm", tab === t.key ? "bg-ink-900 font-medium text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="flex flex-1 gap-2 sm:max-w-md">
          <input type="hidden" name="tab" value={tab} />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="ค้นหาเลข LOT, note, ลูกค้า, รายการ"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
            />
          </div>
          <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">ค้นหา</button>
        </form>
        <span className="ml-auto text-sm text-slate-500">
          ทุนคงเหลือรวม <b className="text-ink-900 tabular-nums">{fmtMoney(remaining)}</b> บาท
        </span>
      </div>
      <Card className="overflow-x-auto">
        <LotTable lots={lots} empty={q ? "ไม่พบ LOT ที่ค้นหา" : "ยังไม่มี LOT"} />
      </Card>
    </>
  );
}
