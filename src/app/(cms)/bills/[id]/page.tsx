import { notFound } from "next/navigation";
import { getBill, getSettings } from "@/lib/queries";
import { getAttachments } from "@/lib/trade-queries";
import { BillView } from "./bill-view";

export const metadata = { title: "บิลรับซื้อ" };

export default async function BillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> }) {
  const id = Number((await params).id);
  const [bill, settings] = await Promise.all([Number.isInteger(id) ? getBill(id) : null, getSettings()]);
  if (!bill) notFound();
  const slips = await getAttachments({ billId: id });
  return <BillView bill={bill} settings={settings} slips={slips} fresh={(await searchParams).fresh === "1"} />;
}
