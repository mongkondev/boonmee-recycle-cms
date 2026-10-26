import { PageHeader } from "@/components/ui";
import { bangkokToday } from "@/lib/bill";
import { getBillProducts } from "@/lib/queries";
import { getSellOptions } from "@/lib/trade-queries";
import { DismantleForm } from "./dismantle-form";

export const metadata = { title: "แยกชิ้นส่วน" };

export default async function DismantlePage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const [stock, products, sp] = await Promise.all([getSellOptions(), getBillProducts(), searchParams]);
  return (
    <>
      <PageHeader
        title="แยกชิ้นส่วน"
        description="ตัดของที่รับซื้อมาออกจากสต็อก แล้วเพิ่มชิ้นส่วนที่แกะได้เข้าสต็อกแทน ทุนของเดิมถูกแบ่งไปที่ชิ้นส่วน"
      />
      <DismantleForm stock={stock} products={products} initialKey={sp.key ?? ""} today={bangkokToday()} />
    </>
  );
}
