import { PageHeader } from "@/components/ui";
import { getCategoryTree } from "@/lib/queries";
import { CategoryManager } from "./category-manager";

export const metadata = { title: "หมวดหมู่" };

export default async function CategoriesPage() {
  const tree = await getCategoryTree();
  return (
    <>
      <PageHeader title="หมวดหมู่สินค้า" description="หมวดหมู่หลัก 1 หมวด มีได้หลายหมวดย่อย — หมวดย่อยจะเป็นหัวข้อแต่ละกลุ่มบนใบราคา" />
      <CategoryManager tree={tree} />
    </>
  );
}
