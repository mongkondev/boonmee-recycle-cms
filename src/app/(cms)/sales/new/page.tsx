import { TradeForm } from "@/components/trade-form";
import { PageHeader } from "@/components/ui";
import { bangkokToday } from "@/lib/bill";
import { getSellOptions } from "@/lib/trade-queries";

export const metadata = { title: "บันทึกขายออก" };

export default async function NewSalePage() {
  const options = await getSellOptions();
  return (
    <>
      <PageHeader title="บันทึกขายออก / รายรับ" description="เลือกรายการจากสต็อกที่ซื้อเข้า ขายไม่หมดได้ ส่วนที่เหลือค้างไว้ขายรอบหน้า" />
      <TradeForm mode="sell" options={options} initial={{ party: "", date: bangkokToday(), paymentMethod: "cash", note: "", rows: [] }} />
    </>
  );
}
