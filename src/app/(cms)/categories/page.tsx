import { PageHeader } from "@/components/ui";
import { getCategoryTree } from "@/lib/queries";
import { CategoryManager } from "./category-manager";

export const metadata = { title: "หมวดหมู่" };

export default async function CategoriesPage() {
  const tree = await getCategoryTree();
  return (
    <>
      <PageHeader title="หมวดหมู่สินค้า" description="สินค้าต้องอยู่ในหมวดหลัก ส่วนหมวดย่อยไม่บังคับ ใช้จัดกลุ่มรายการภายใต้หัวข้อหมวดหลักบนเมนูราคา" />
      <CategoryManager tree={tree} />
    </>
  );
}
