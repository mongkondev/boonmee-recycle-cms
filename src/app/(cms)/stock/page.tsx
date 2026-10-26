import { PageHeader } from "@/components/ui";
import { getBillProducts } from "@/lib/queries";
import { getStockSummary } from "@/lib/trade-queries";
import { StockIn } from "./stock-in";

export const metadata = { title: "สต็อกสินค้า" };

export default async function StockPage() {
  const [products, summary] = await Promise.all([getBillProducts(), getStockSummary()]);
  return (
    <>
      <PageHeader
        title="สต็อกสินค้า / รับเข้าสต็อก"
        description="เติมของที่ได้มาโดยไม่ได้รับซื้อ เช่น ทองแดงที่แกะจากทีวี — นับรวมกับของชนิดเดียวกันใน LOT และหักออกเมื่อขาย"
      />
      <StockIn products={products} items={summary.items} history={summary.stock.toReversed().slice(0, 30)} />
    </>
  );
}
