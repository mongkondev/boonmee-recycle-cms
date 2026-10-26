import { notFound } from "next/navigation";
import { TradeForm } from "@/components/trade-form";
import { bangkokDay, fmtBillNo } from "@/lib/bill";
import { toParty } from "@/lib/party";
import { getBill, getBillProducts, getSettings, getUnits } from "@/lib/queries";
import { getAttachments, getCustomers } from "@/lib/trade-queries";

export const metadata = { title: "แก้ไขรายการรับซื้อ" };

export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [bill, products, customers, units, settings] = await Promise.all([
    Number.isInteger(id) ? getBill(id) : null,
    getBillProducts(),
    getCustomers(),
    getUnits(),
    getSettings(),
  ]);
  const slips = Number.isInteger(id) ? await getAttachments({ billId: id }) : [];
  if (!bill) notFound();
  return (
    <>
      <TradeForm
        title={bill.billNo ? `แก้ไขบิล ${fmtBillNo(bill.billNo)} · ${bill.lotNo}` : `แก้ไขรายการรับซื้อ ${bill.lotNo}`}
        mode="buy"
        products={products}
        customers={customers}
        units={units.map((u) => u.name)}
        settings={settings}
        initial={{
          id: bill.id,
          hasBillNo: bill.billNo !== null,
          billNo: bill.billNo,
          lotNo: bill.lotNo,
          lotNote: bill.lotNote ?? "",
          slips: slips.map((s) => s.imageId),
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
