import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { getCategoryTree, getUnits } from "@/lib/queries";
import { ProductForm } from "../product-form";

export const metadata = { title: "แก้ไขสินค้า" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [p, tree, units] = await Promise.all([
    db.query.products.findFirst({ where: eq(schema.products.id, id) }),
    getCategoryTree(),
    getUnits(),
  ]);
  if (!p) notFound();
  const main = tree.find((m) => m.subs.some((s) => s.id === p.subCategoryId));
  return (
    <>
      <PageHeader title="แก้ไขสินค้า" description={p.title} />
      <ProductForm
        tree={tree}
        units={units}
        initial={{
          id: p.id,
          title: p.title,
          description: p.description ?? "",
          price: String(p.price),
          priceNote: p.priceNote ?? "",
          unitId: p.unitId ? String(p.unitId) : "",
          mainCategoryId: main ? String(main.id) : "",
          subCategoryId: String(p.subCategoryId),
          isActive: p.isActive,
          imageId: p.imageId,
        }}
      />
    </>
  );
}
