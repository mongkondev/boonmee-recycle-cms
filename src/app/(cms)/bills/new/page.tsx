import { PageHeader } from "@/components/ui";
import { bangkokToday } from "@/lib/bill";
import { getBillProducts } from "@/lib/queries";
import { BillForm } from "../bill-form";

export const metadata = { title: "สร้างบิลรับซื้อ" };

export default async function NewBillPage() {
  const products = await getBillProducts();
  return (
    <>
      <PageHeader title="สร้างบิลเงินสดรับซื้อ" description="เลือกรายการ ระบบใส่ราคาล่าสุดให้อัตโนมัติ แก้ไขราคาได้ก่อนบันทึก" />
      <BillForm products={products} initial={{ customerName: "", billDate: bangkokToday(), paymentMethod: "cash", note: "", rows: [] }} />
    </>
  );
}
