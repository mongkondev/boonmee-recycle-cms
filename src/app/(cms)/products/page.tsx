import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getCategoryTree, getProducts } from "@/lib/queries";
import { ProductTable } from "./product-table";

export const metadata = { title: "สินค้ารับซื้อ" };

export default async function ProductsPage() {
  const [products, tree] = await Promise.all([getProducts(), getCategoryTree()]);
  return (
    <>
      <PageHeader
        title="สินค้ารับซื้อ"
        description={`ทั้งหมด ${products.length} รายการ`}
        actions={
          <Link href="/products/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-600">
            <Plus className="size-4" /> เพิ่มสินค้า
          </Link>
        }
      />
      <ProductTable rows={products} tree={tree} />
    </>
  );
}
