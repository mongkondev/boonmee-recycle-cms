"use client";

import { ArrowLeft, CheckCircle2, FileCheck2, LoaderCircle, Package, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DocExport } from "@/components/doc-export";
import { Slips } from "@/components/slips";
import { Button, Card, FormError, PageHeader } from "@/components/ui";
import { deleteBill, issueBill } from "@/lib/bill-actions";
import { fmtBillNo, PAYMENT_LABEL } from "@/lib/bill";
import type { BillDetail } from "@/lib/queries";
import type { ShopSettings } from "@/lib/types";

export function BillView({ bill, settings, slips, fresh }: { bill: BillDetail; settings: ShopSettings; slips: { id: number; imageId: string }[]; fresh: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const issued = bill.billNo !== null;
  const no = issued ? fmtBillNo(bill.billNo!) : null;
  const c = bill.customer;

  const remove = async () => {
    if (!confirm(`ลบรายการรับซื้อ ${bill.lotNo}${no ? ` (บิล ${no})` : ""} ?`)) return;
    setBusy("delete");
    const res = await deleteBill(bill.id);
    if (!res.ok) {
      setBusy(null);
      return setError(res.error);
    }
    router.push("/bills");
  };

  return (
    <>
      <PageHeader
        title={issued ? `บิลเลขที่ ${no}` : "รายการรับซื้อ (ยังไม่ออกบิล)"}
        description={`${bill.lotNo} · ${bill.customerName ?? "ไม่ระบุชื่อลูกค้า"} · ${bill.items.length} รายการ · จ่าย${PAYMENT_LABEL[bill.paymentMethod]}`}
        actions={
          <Link href="/bills" className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="size-4" /> ทั้งหมด
          </Link>
        }
      />

      {fresh && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <CheckCircle2 className="size-5 shrink-0" />
          {issued ? `บันทึกแล้ว ${bill.lotNo} — ส่งรูปหรือ PDF ให้ลูกค้าได้เลย` : `บันทึกรับซื้อแล้ว ${bill.lotNo} — ออกบิลทีหลังได้จากหน้านี้`}
        </div>
      )}

      <DocExport
        doc={{
          kind: "buy",
          no,
          lotNo: bill.lotNo,
          party: bill.customerName,
          date: bill.billDate,
          paymentMethod: bill.paymentMethod,
          total: bill.total,
          note: bill.note,
          bankLine: c?.bankAccount ? `โอนเข้า ${c.bankName ?? ""} ${c.bankAccount}` : null,
          items: bill.items,
        }}
        settings={settings}
        fileBase={`บิลรับซื้อ-${no ?? bill.lotNo}`}
        shareTitle={`บิลรับซื้อ ${no}`}
        exportable={issued}
        notice={
          !issued && (
            <>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">ยังไม่ได้ออกบิล — รายการนี้เป็น LOT ที่ขายได้แล้ว</p>
              <Button
                className="w-full"
                disabled={!!busy}
                onClick={async () => {
                  setBusy("issue");
                  await issueBill(bill.id);
                  router.refresh();
                  setBusy(null);
                }}
              >
                {busy === "issue" ? <LoaderCircle className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} ออกบิล (รันเลขที่บิล)
              </Button>
            </>
          )
        }
        aside={
          <>
            <Slips target={{ billId: bill.id }} items={slips} />
            <Card className="space-y-3 p-3">
              <Link href={`/lots/${bill.id}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-brand-50">
                <Package className="size-4 text-brand-600" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900 tabular-nums">{bill.lotNo}</span>
                  <span className="block truncate text-xs text-slate-500">{bill.lotNote ?? "ดู LOT · ขายไป / คงเหลือ"}</span>
                </span>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/bills/${bill.id}/edit`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  <Pencil className="size-4" /> แก้ไข
                </Link>
                <Button variant="ghost" className="text-accent-600 hover:bg-accent-50" disabled={!!busy} onClick={remove}>
                  <Trash2 className="size-4" /> ลบ
                </Button>
                <Link href="/bills/new" className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50">
                  <Plus className="size-4" /> รับซื้อรายการใหม่
                </Link>
              </div>
              <FormError message={error} />
            </Card>
          </>
        }
      />
    </>
  );
}
