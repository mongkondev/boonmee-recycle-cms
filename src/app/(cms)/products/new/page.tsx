import { PageHeader } from "@/components/ui";
import { getCategoryTree, getUnits } from "@/lib/queries";
import { ProductForm } from "../product-form";

export const metadata = { title: "เพิ่มสินค้า" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ main?: string; sub?: string }> }) {
  const [tree, units, q] = await Promise.all([getCategoryTree(), getUnits(), searchParams]);
  const main = tree.find((m) => String(m.id) === q.main || m.subs.some((s) => String(s.id) === q.sub));
  const sub = main?.subs.find((s) => String(s.id) === q.sub);
  return (
    <>
      <PageHeader title="เพิ่มสินค้ารับซื้อ" />
      <ProductForm
        tree={tree}
        units={units}
        initial={{
          title: "",
          description: "",
          price: "",
          priceNote: "",
          unitId: String(units[0]?.id ?? ""),
          mainCategoryId: main ? String(main.id) : "",
          subCategoryId: sub ? String(sub.id) : "",
          isActive: true,
          imageId: null,
        }}
      />
    </>
  );
}
