"use client";

import { Landmark, Pencil, Phone, Save, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, FormError, Input } from "@/components/ui";
import { fmtMoney } from "@/lib/bill";
import { deleteCustomer, saveCustomer } from "@/lib/trade-actions";
import type { getCustomerStats } from "@/lib/trade-queries";
import { fmtDate } from "@/lib/trend";

type Row = Awaited<ReturnType<typeof getCustomerStats>>[number];

export function CustomerList({ customers, empty }: { customers: Row[]; empty: string }) {
  if (!customers.length) return <Card className="p-12 text-center text-slate-400"><UserRound className="mx-auto mb-3 size-8" />{empty}</Card>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {customers.map((c) => <CustomerCard key={c.id} c={c} />)}
    </div>
  );
}

function CustomerCard({ c }: { c: Row }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ name: c.name, phone: c.phone ?? "", bankName: c.bankName ?? "", bankAccount: c.bankAccount ?? "" });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (editing) {
    return (
      <Card className="space-y-2 p-4">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="ชื่อ" aria-label="ชื่อ" />
        <Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="เบอร์โทร" aria-label="เบอร์โทร" type="tel" />
        <div className="grid grid-cols-[8rem_1fr] gap-2">
          <Input value={v.bankName} onChange={(e) => setV({ ...v, bankName: e.target.value })} placeholder="ธนาคาร" aria-label="ธนาคาร" />
          <Input value={v.bankAccount} onChange={(e) => setV({ ...v, bankAccount: e.target.value })} placeholder="เลขที่บัญชี" aria-label="เลขที่บัญชี" inputMode="numeric" />
        </div>
        <FormError message={error} />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await saveCustomer(c.id, v);
              setBusy(false);
              if (!res.ok) return setError(res.error);
              setEditing(false);
              router.refresh();
            }}
          >
            <Save className="size-3.5" /> บันทึก
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="size-3.5" /> ยกเลิก
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink-900">{c.name}</div>
          <div className="mt-1 space-y-0.5 text-sm text-slate-500">
            {c.phone && <div className="flex items-center gap-1.5"><Phone className="size-3.5" /> <a href={`tel:${c.phone}`} className="hover:text-brand-600">{c.phone}</a></div>}
            {c.bankAccount && <div className="flex items-center gap-1.5"><Landmark className="size-3.5" /> {c.bankName} {c.bankAccount}</div>}
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label={`แก้ไข ${c.name}`}>
          <Pencil className="size-4" />
        </button>
        <button
          onClick={async () => {
            if (!confirm(`ลบ "${c.name}" ออกจากรายชื่อลูกค้า? (บิลและใบขายเดิมยังอยู่)`)) return;
            await deleteCustomer(c.id);
            router.refresh();
          }}
          className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-accent-50 hover:text-accent-500"
          aria-label={`ลบ ${c.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
        <Link href={`/bills?q=${encodeURIComponent(c.name)}`} className="rounded-lg bg-slate-50 px-2.5 py-1.5 hover:bg-brand-50">
          <span className="text-slate-500">รับซื้อจาก ({c.buyCount})</span>
          <span className="block text-sm font-semibold text-ink-900 tabular-nums">{fmtMoney(c.buyAmount)}</span>
        </Link>
        <Link href={`/sales?q=${encodeURIComponent(c.name)}`} className="rounded-lg bg-slate-50 px-2.5 py-1.5 hover:bg-brand-50">
          <span className="text-slate-500">ขายให้ ({c.sellCount})</span>
          <span className="block text-sm font-semibold text-ink-900 tabular-nums">{fmtMoney(c.sellAmount)}</span>
        </Link>
      </div>
      {c.lastUsed && <div className="mt-2 text-xs text-slate-400">ล่าสุด {fmtDate(c.lastUsed)}</div>}
    </Card>
  );
}
