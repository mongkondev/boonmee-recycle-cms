"use client";

import { Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { saveLotNote, setLotClosed } from "@/lib/trade-actions";

/** Lot note (saved when the field loses focus) and close / reopen. */
export function LotControls({ id, note, closed }: { id: number; note: string; closed: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(note);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="flex flex-wrap items-end gap-4 p-4">
      <div className="min-w-60 flex-1">
        <Label htmlFor="lotNote">Note ของ LOT {saved && <span className="ml-2 text-xs font-normal text-brand-600">บันทึกแล้ว</span>}</Label>
        <Input
          id="lotNote"
          value={value}
          maxLength={500}
          placeholder="เช่น แกะทองแดงไปแล้วครึ่งหนึ่ง"
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          onBlur={async () => {
            if (value === note) return;
            await saveLotNote(id, value);
            setSaved(true);
            router.refresh();
          }}
        />
      </div>
      <Button
        variant={closed ? "secondary" : "primary"}
        disabled={busy}
        onClick={async () => {
          if (!closed && !confirm("ปิด LOT นี้? จะไม่แสดงให้เลือกตอนขายออกอีก (เปิดใหม่ได้)")) return;
          setBusy(true);
          await setLotClosed(id, !closed);
          router.refresh();
          setBusy(false);
        }}
      >
        {closed ? <LockOpen className="size-4" /> : <Lock className="size-4" />} {closed ? "เปิด LOT อีกครั้ง" : "ปิด LOT (ขายหมดแล้ว)"}
      </Button>
    </Card>
  );
}
