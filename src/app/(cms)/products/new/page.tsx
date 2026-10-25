import { PageHeader } from "@/components/ui";
import { getCategoryTree, getUnits } from "@/lib/queries";
import { ProductForm } from "../product-form";

export const metadata = { title: "เพิ่มสินค้า" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const [tree, units, { sub }] = await Promise.all([getCategoryTree(), getUnits(), searchParams]);
  const main = tree.find((m) => m.subs.some((s) => String(s.id) === sub));
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
          subCategoryId: main ? String(sub) : "",
          isActive: true,
          imageId: null,
        }}
      />
    </>
  );
}
