import { notFound } from "next/navigation";
import { TradeForm } from "@/components/trade-form";
import { PageHeader } from "@/components/ui";
import { bangkokDay, fmtBillNo } from "@/lib/bill";
import { toParty } from "@/lib/party";
import { getBill, getBillProducts, getUnits } from "@/lib/queries";
import { getCustomers } from "@/lib/trade-queries";

export const metadata = { title: "แก้ไขรายการรับซื้อ" };

export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [bill, products, customers, units] = await Promise.all([
    Number.isInteger(id) ? getBill(id) : null,
    getBillProducts(),
    getCustomers(),
    getUnits(),
  ]);
  if (!bill) notFound();
  return (
    <>
      <PageHeader title={bill.billNo ? `แก้ไขบิล ${fmtBillNo(bill.billNo)} · ${bill.lotNo}` : `แก้ไขรายการรับซื้อ ${bill.lotNo}`} />
      <TradeForm
        mode="buy"
        products={products}
        customers={customers}
        units={units.map((u) => u.name)}
        initial={{
          id: bill.id,
          hasBillNo: bill.billNo !== null,
          lotNo: bill.lotNo,
          lotNote: bill.lotNote ?? "",
          party: toParty(bill.customerName, bill.customer),
          date: bangkokDay(new Date(bill.billDate)),
          paymentMethod: bill.paymentMethod,
          note: bill.note ?? "",
          rows: bill.items.map((i) => ({
            itemId: i.id,
            sourceItemId: null,
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
