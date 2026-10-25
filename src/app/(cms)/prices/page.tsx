import { PageHeader } from "@/components/ui";
import { getProducts } from "@/lib/queries";
import { PriceGrid } from "./price-grid";

export const metadata = { title: "ปรับปรุงราคา" };

export default async function PricesPage() {
  const products = await getProducts();
  return (
    <>
      <PageHeader title="ปรับปรุงราคา" description="แก้ไขราคารับซื้อทั้งหมดในหน้าเดียว — พิมพ์ราคาแล้วกด Enter เพื่อบันทึกร่าง จากนั้นกด Publish เพื่อประกาศราคา" />
      <PriceGrid initial={products} />
    </>
  );
}
