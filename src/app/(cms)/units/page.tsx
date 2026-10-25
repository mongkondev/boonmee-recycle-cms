import { PageHeader } from "@/components/ui";
import { getUnits } from "@/lib/queries";
import { UnitManager } from "./unit-manager";

export const metadata = { title: "หน่วย" };

export default async function UnitsPage() {
  const units = await getUnits();
  return (
    <>
      <PageHeader title="หน่วยนับ (Master)" description="ใช้เป็นตัวเลือก dropdown ในหน้าสินค้า เช่น กก., ชิ้น, เครื่อง" />
      <UnitManager units={units} />
    </>
  );
}
