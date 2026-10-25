import { PageHeader } from "@/components/ui";
import { getProducts, getSettings } from "@/lib/queries";
import { Exporter } from "./exporter";

export const metadata = { title: "ส่งออกใบราคา" };

export default async function ExportPage() {
  const [products, settings] = await Promise.all([getProducts(), getSettings()]);
  // only what customers should see: active products in active categories
  const visible = products.filter((p) => p.isActive && p.subActive && p.mainActive);
  return (
    <>
      <PageHeader title="ส่งออกใบราคา" description="สร้างใบราคารับซื้อเป็นรูป PNG / PDF เพื่อส่งให้ลูกค้าทาง LINE / Facebook" />
      <Exporter products={visible} settings={settings} />
    </>
  );
}
