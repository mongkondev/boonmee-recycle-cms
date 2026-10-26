import { TradeForm } from "@/components/trade-form";
import { bangkokToday } from "@/lib/bill";
import { emptyParty } from "@/lib/party";
import { getSettings, getUnits } from "@/lib/queries";
import { getCustomers, getSellProducts, getSourceOptions, getStockSources } from "@/lib/trade-queries";

export const metadata = { title: "ขายออก" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  const [products, sources, stock, customers, units, settings, sp] = await Promise.all([
    getSellProducts(),
    getSourceOptions(),
    getStockSources(),
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
        description="เลือก LOT แล้วเพิ่มแถวเลือกของใน LOT นั้น หรือ “ไม่ระบุ LOT” แล้วระบบหา LOT จากสินค้าให้ · ยอดขายหักทุนคงเหลือของ LOT อัตโนมัติ"
        mode="sell"
        products={products}
        sources={sources}
        stock={stock}
        customers={customers}
        units={units.map((u) => u.name)}
        settings={settings}
        initial={{
          party: emptyParty(),
          date: bangkokToday(),
          paymentMethod: "cash",
          note: "",
          rows: first ? [{ lotId: first.lotId, sourceItemId: sources.filter((s) => s.lotId === first.lotId).length === 1 ? first.id : null, productId: null, title: "", unitName: "", qty: "", unitPrice: "" }] : [],
        }}
      />
    </>
  );
}
