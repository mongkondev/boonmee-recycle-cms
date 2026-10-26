import { TradeForm } from "@/components/trade-form";
import { bangkokToday } from "@/lib/bill";
import { emptyParty } from "@/lib/party";
import { getBillProducts, getSettings, getUnits } from "@/lib/queries";
import { getCustomers } from "@/lib/trade-queries";

export const metadata = { title: "รับซื้อเข้า" };

export default async function NewBillPage() {
  const [products, customers, units, settings] = await Promise.all([getBillProducts(), getCustomers(), getUnits(), getSettings()]);
  return (
    <>
      <TradeForm
        title="รับซื้อเข้า / ออกบิล"
        description="ทุกการรับซื้อได้เลข LOT อัตโนมัติ · ราคาดึงจากราคาล่าสุด แก้ไขได้ · ยังไม่ออกบิลก็บันทึกไว้ก่อนได้"
        mode="buy"
        products={products}
        customers={customers}
        units={units.map((u) => u.name)}
        settings={settings}
        initial={{ party: emptyParty(), date: bangkokToday(), paymentMethod: "cash", note: "", rows: [] }}
      />
    </>
  );
}
