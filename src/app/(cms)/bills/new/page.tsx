import { PageHeader } from "@/components/ui";
import { bangkokToday } from "@/lib/bill";
import { getBillProducts } from "@/lib/queries";
import { TradeForm } from "@/components/trade-form";

export const metadata = { title: "สร้างบิลรับซื้อ" };

export default async function NewBillPage() {
  const products = await getBillProducts();
  return (
    <>
      <PageHeader title="รับซื้อเข้า / ออกบิล" description="เลือกรายการ ระบบใส่ราคาล่าสุดให้อัตโนมัติ แก้ไขราคาได้ · ยังไม่ออกบิลก็บันทึกไว้ก่อนได้" />
      <TradeForm mode="buy" options={products} initial={{ party: "", date: bangkokToday(), paymentMethod: "cash", note: "", rows: [] }} />
    </>
  );
}
