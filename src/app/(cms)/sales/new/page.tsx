import { TradeForm } from "@/components/trade-form";
import { PageHeader } from "@/components/ui";
import { bangkokToday } from "@/lib/bill";
import { emptyParty } from "@/lib/party";
import { getUnits } from "@/lib/queries";
import { getCustomers, getSellProducts, getSourceOptions } from "@/lib/trade-queries";

export const metadata = { title: "ขายออก" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  const [products, sources, customers, units, sp] = await Promise.all([getSellProducts(), getSourceOptions(), getCustomers(), getUnits(), searchParams]);
  // opened from a lot page: start the first line on that lot
  const first = sp.lot ? sources.find((s) => String(s.lotId) === sp.lot) : undefined;
  return (
    <>
      <PageHeader title="ขายออก / รายรับ" description="แต่ละแถวเลือกว่าขายจาก LOT / รายการซื้อไหน แล้วใส่ของที่ขายจริง เช่น ทองแดงจาก LOT ตู้เย็น ยอดขายจะหักทุนคงเหลือของ LOT" />
      <TradeForm
        mode="sell"
        products={products}
        sources={sources}
        customers={customers}
        units={units.map((u) => u.name)}
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
