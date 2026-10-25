"use client";

import { useRouter } from "next/navigation";
import { EditList } from "@/components/edit-list";
import { Card } from "@/components/ui";
import { deleteUnit, reorder, saveUnit, type ActionResult } from "@/lib/actions";
import type { Unit } from "@/lib/types";

export function UnitManager({ units }: { units: Unit[] }) {
  const router = useRouter();
  const act = async (p: Promise<ActionResult>) => {
    const res = await p;
    router.refresh();
    if (!res.ok) return res.error;
  };
  return (
    <Card className="max-w-xl">
      <EditList
        placeholder="ชื่อหน่วยใหม่ เช่น กก."
        items={units.map((u) => ({ id: u.id, name: u.name, meta: `ใช้กับ ${u.productCount} สินค้า` }))}
        onCreate={(name) => act(saveUnit({ name }))}
        onRename={(id, name) => act(saveUnit({ id, name }))}
        onDelete={(item) => act(deleteUnit(item.id))}
        onReorder={(ids) => act(reorder("unit", ids))}
      />
    </Card>
  );
}
