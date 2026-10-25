import { PageHeader } from "@/components/ui";
import { getProducts, getSettings } from "@/lib/queries";
import { Exporter } from "./exporter";

export const metadata = { title: "เมนูราคา" };

export default async function ExportPage() {
  const [products, settings] = await Promise.all([getProducts(), getSettings()]);
  // only what customers should see: active products in active categories
  const visible = products.filter((p) => p.isActive && p.subActive && p.mainActive);
  return (
    <>
      <PageHeader title="เมนูราคารับซื้อ" description="ป้ายเมนูราคาแบบร้านอาหาร ส่งออกเป็นรูป PNG / PDF เพื่อส่งให้ลูกค้าทาง LINE / Facebook หรือพิมพ์ติดหน้าร้าน" />
      <Exporter products={visible} settings={settings} />
    </>
  );
}
