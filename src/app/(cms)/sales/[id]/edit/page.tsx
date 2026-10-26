import { notFound } from "next/navigation";
import { TradeForm } from "@/components/trade-form";
import { bangkokDay, fmtSaleNo } from "@/lib/bill";
import { toParty } from "@/lib/party";
import { getSettings, getUnits } from "@/lib/queries";
import { getAttachments, getCustomers, getSale, getSellProducts, getSourceOptions } from "@/lib/trade-queries";

export const metadata = { title: "แก้ไขใบขาย" };

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const sale = Number.isInteger(id) ? await getSale(id) : null;
  if (!sale) notFound();
  const [products, sources, customers, units, settings, slips] = await Promise.all([
    getSellProducts(),
    getSourceOptions(id),
    getCustomers(),
    getUnits(),
    getSettings(),
    getAttachments({ saleId: id }),
  ]);
  return (
    <>
      <TradeForm
        title={`แก้ไขใบขาย ${fmtSaleNo(sale.id)}`}
        description="ทุนคงเหลือที่แสดงคิดคืนยอดของใบขายนี้ให้แล้ว"
        mode="sell"
        products={products}
        sources={sources}
        customers={customers}
        units={units.map((u) => u.name)}
        settings={settings}
        initial={{
          id: sale.id,
          party: toParty(sale.buyerName, sale.customer),
          date: bangkokDay(new Date(sale.saleDate)),
          paymentMethod: sale.paymentMethod,
          note: sale.note ?? "",
          slips: slips.filter((s) => s.kind === "slip").map((s) => s.imageId),
          bills: slips.filter((s) => s.kind === "bill").map((s) => s.imageId),
          rows: sale.items.map((i) => ({
            sourceItemId: i.sourceItemId,
            lotId: i.lotId,
            noLot: i.lotId === null && i.sourceItemId === null,
            auto: i.autoLot,
            productId: i.productId,
            title: i.title,
            unitName: i.unitName ?? "",
            qty: String(i.qty),
            unitPrice: String(i.unitPrice),
          })),
        }}
      />
    </>
  );
}
