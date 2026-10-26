import { TradeForm } from "@/components/trade-form";
import { bangkokToday } from "@/lib/bill";
import { emptyParty } from "@/lib/party";
import { getSettings, getUnits } from "@/lib/queries";
import { getCustomers, getSellProducts, getSourceOptions } from "@/lib/trade-queries";

export const metadata = { title: "ขายออก" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  const [products, sources, customers, units, settings, sp] = await Promise.all([
    getSellProducts(),
    getSourceOptions(),
    getCustomers(),
    getUnits(),
    getSettings(),
    searchParams,
  ]);
  // opened from a lot page: start the first line on that lot
  const first = sp.lot ? sources.find((s) => String(s.lotId) === sp.lot) : undefined;
  return (
    <>
      <TradeForm
        title="ขายออก / รายรับ"
        description="เลือก LOT ครั้งเดียว แล้วเพิ่มของที่ขายจริงได้หลายรายการ เช่น ทองแดง เหล็ก จาก LOT ตู้เย็น · ยอดขายหักทุนคงเหลือของ LOT"
        mode="sell"
        products={products}
        sources={sources}
        customers={customers}
        units={units.map((u) => u.name)}
        settings={settings}
        initial={{
          party: emptyParty(),
          date: bangkokToday(),
          paymentMethod: "cash",
          note: "",
          rows: first ? [{ sourceItemId: first.id, productId: null, title: "", unitName: "", qty: "", unitPrice: "" }] : [],
        }}
      />
    </>
  );
}
