"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAdjustment } from "@/lib/trade-actions";

export function DeleteAdjustment({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      aria-label="ยกเลิกการแยกชิ้นส่วนนี้"
      title="ยกเลิกการแยกชิ้นส่วนนี้"
      className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-accent-50 hover:text-accent-500 disabled:opacity-50"
      onClick={async () => {
        if (!confirm("ยกเลิกการแยกชิ้นส่วนนี้? ของเดิมจะคืนเข้าสต็อก และชิ้นส่วนจะถูกหักออก")) return;
        setBusy(true);
        await deleteAdjustment(id);
        router.refresh();
        setBusy(false);
      }}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
