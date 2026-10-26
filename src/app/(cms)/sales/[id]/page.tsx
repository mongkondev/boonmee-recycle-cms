import { notFound } from "next/navigation";
import { getSettings } from "@/lib/queries";
import { getAttachments, getSale } from "@/lib/trade-queries";
import { SaleView } from "./sale-view";

export const metadata = { title: "ใบขาย" };

export default async function SalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> }) {
  const id = Number((await params).id);
  const [sale, settings] = await Promise.all([Number.isInteger(id) ? getSale(id) : null, getSettings()]);
  if (!sale) notFound();
  const slips = await getAttachments({ saleId: id });
  return <SaleView sale={sale} settings={settings} slips={slips} fresh={(await searchParams).fresh === "1"} />;
}
