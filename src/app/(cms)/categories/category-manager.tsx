"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditList } from "@/components/edit-list";
import { Card } from "@/components/ui";
import { deleteMainCategory, deleteSubCategory, reorder, saveMainCategory, saveSubCategory, type ActionResult } from "@/lib/actions";
import type { CategoryTree } from "@/lib/types";

export function CategoryManager({ tree }: { tree: CategoryTree }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | undefined>(tree[0]?.id);
  const main = tree.find((m) => m.id === selected) ?? tree[0];

  // run an action, refresh server data, and surface its error message (if any) to EditList
  const act = async (p: Promise<ActionResult>) => {
    const res = await p;
    router.refresh();
    if (!res.ok) return res.error;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-ink-900">หมวดหมู่หลัก</h2>
          <p className="text-xs text-slate-400">คลิกเพื่อดู/จัดการหมวดย่อย</p>
        </div>
        <EditList
          placeholder="ชื่อหมวดหมู่หลักใหม่"
          items={tree.map((m) => ({ id: m.id, name: m.name, isActive: m.isActive, meta: `${m.subs.length} หมวดย่อย · ${m.subs.reduce((a, s) => a + s.productCount, 0)} สินค้า` }))}
          selectedId={main?.id}
          onSelect={setSelected}
          onCreate={(name) => act(saveMainCategory({ name }))}
          onRename={(id, name) => act(saveMainCategory({ id, name }))}
          onToggle={(id, isActive) => act(saveMainCategory({ id, name: tree.find((m) => m.id === id)!.name, isActive }))}
          onDelete={(item) => act(deleteMainCategory(item.id))}
          onReorder={(ids) => act(reorder("main", ids))}
        />
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-ink-900">
            หมวดหมู่ย่อย {main && <span className="font-normal text-brand-600">· {main.name}</span>}
          </h2>
          <p className="text-xs text-slate-400">ลำดับที่นี่ = ลำดับหัวข้อบนใบราคา</p>
        </div>
        {main ? (
          <EditList
            key={main.id}
            placeholder={`หมวดย่อยใหม่ใน "${main.name}"`}
            items={main.subs.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive, meta: `${s.productCount} สินค้า` }))}
            onCreate={(name) => act(saveSubCategory({ mainCategoryId: main.id, name }))}
            onRename={(id, name) => act(saveSubCategory({ id, mainCategoryId: main.id, name }))}
            onToggle={(id, isActive) => act(saveSubCategory({ id, mainCategoryId: main.id, name: main.subs.find((s) => s.id === id)!.name, isActive }))}
            onDelete={(item) => act(deleteSubCategory(item.id))}
            onReorder={(ids) => act(reorder("sub", ids))}
            extra={(item) => (
              <Link
                href={`/products/new?sub=${item.id}`}
                onClick={(e) => e.stopPropagation()}
                className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 sm:inline-flex"
              >
                <Plus className="size-3" /> สินค้า
              </Link>
            )}
          />
        ) : (
          <p className="p-10 text-center text-sm text-slate-400">สร้างหมวดหมู่หลักก่อน</p>
        )}
      </Card>
    </div>
  );
}
