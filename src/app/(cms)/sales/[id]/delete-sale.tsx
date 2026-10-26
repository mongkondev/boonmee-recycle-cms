"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { deleteSale } from "@/lib/trade-actions";

export function DeleteSale({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      className="text-accent-600 hover:bg-accent-50"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`ลบรายการขาย #${id} ? จำนวนจะคืนเข้าสต็อก`)) return;
        setBusy(true);
        await deleteSale(id);
        router.push("/sales");
      }}
    >
      <Trash2 className="size-4" /> ลบรายการขาย
    </Button>
  );
}
