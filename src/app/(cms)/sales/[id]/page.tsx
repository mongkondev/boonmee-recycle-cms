import { notFound } from "next/navigation";
import { TradeForm } from "@/components/trade-form";
import { PageHeader } from "@/components/ui";
import { bangkokDay } from "@/lib/bill";
import { getSale, getSellOptions } from "@/lib/trade-queries";
import { DeleteSale } from "./delete-sale";

export const metadata = { title: "แก้ไขรายการขาย" };

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const sale = Number.isInteger(id) ? await getSale(id) : null;
  if (!sale) notFound();
  const options = await getSellOptions(id);
  return (
    <>
      <PageHeader title={`รายการขาย #${sale.id}`} description="แก้ไขแล้วกดบันทึก จำนวนคงเหลือคิดรวมรายการนี้คืนให้แล้ว" actions={<DeleteSale id={sale.id} />} />
      <TradeForm
        mode="sell"
        options={options}
        initial={{
          id: sale.id,
          party: sale.buyerName ?? "",
          date: bangkokDay(new Date(sale.saleDate)),
          paymentMethod: sale.paymentMethod,
          note: sale.note ?? "",
          rows: sale.items.map((i) => ({
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
