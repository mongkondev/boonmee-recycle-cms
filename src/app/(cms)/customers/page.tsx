import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCustomerStats } from "@/lib/trade-queries";
import { CustomerList } from "./customer-list";

export const metadata = { title: "ลูกค้า" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const customers = await getCustomerStats(q);
  return (
    <>
      <PageHeader title="ลูกค้า" description="บันทึกอัตโนมัติจากชื่อที่กรอกตอนรับซื้อ / ขายออก · แก้ไขเบอร์และบัญชีได้ที่นี่" />
      <form className="mb-4 flex gap-2">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาชื่อ เบอร์โทร หรือเลขบัญชี"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
        </div>
        <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">ค้นหา</button>
      </form>
      <CustomerList customers={customers} empty={q ? "ไม่พบลูกค้าที่ค้นหา" : "ยังไม่มีลูกค้า — จะเพิ่มอัตโนมัติเมื่อกรอกชื่อตอนรับซื้อ / ขาย"} />
    </>
  );
}
