import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { fmtBillNo } from "@/lib/bill";
import { getBill, getBillProducts } from "@/lib/queries";
import { TradeForm } from "@/components/trade-form";

export const metadata = { title: "แก้ไขบิล" };

export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [bill, products] = await Promise.all([Number.isInteger(id) ? getBill(id) : null, getBillProducts()]);
  if (!bill) notFound();
  return (
    <>
      <PageHeader title={bill.billNo ? `แก้ไขบิล เลขที่ ${fmtBillNo(bill.billNo)}` : `แก้ไขรายการรับซื้อ #${bill.id}`} />
      <TradeForm
        mode="buy"
        options={products}
        initial={{
          id: bill.id,
          hasBillNo: bill.billNo !== null,
          party: bill.customerName ?? "",
          date: new Date(bill.billDate).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }),
          paymentMethod: bill.paymentMethod,
          note: bill.note ?? "",
          rows: bill.items.map((i) => ({
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
