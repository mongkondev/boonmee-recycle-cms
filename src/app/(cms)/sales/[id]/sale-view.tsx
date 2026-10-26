"use client";

import { ArrowLeft, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DocExport } from "@/components/doc-export";
import { Slips } from "@/components/slips";
import { Button, Card, PageHeader } from "@/components/ui";
import { fmtSaleNo, PAYMENT_LABEL } from "@/lib/bill";
import { deleteSale } from "@/lib/trade-actions";
import type { getSale } from "@/lib/trade-queries";
import type { ShopSettings } from "@/lib/types";

type Sale = NonNullable<Awaited<ReturnType<typeof getSale>>>;

export function SaleView({
  sale,
  settings,
  slips,
  fresh,
}: {
  sale: Sale;
  settings: ShopSettings;
  slips: { id: number; imageId: string; kind: "slip" | "bill" }[];
  fresh: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const no = fmtSaleNo(sale.id);

  return (
    <>
      <PageHeader
        title={`ใบขาย ${no}`}
        description={`${sale.buyerName ?? "ไม่ระบุผู้ซื้อ"} · ${sale.items.length} รายการ · รับเงิน${PAYMENT_LABEL[sale.paymentMethod]}`}
        actions={
          <Link href="/sales" className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="size-4" /> ทั้งหมด
          </Link>
        }
      />
      {fresh && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <CheckCircle2 className="size-5 shrink-0" /> บันทึกการขายแล้ว — หักทุนคงเหลือของ LOT ให้แล้ว
        </div>
      )}
      <DocExport
        doc={{
          kind: "sell",
          no,
          party: sale.buyerName,
          date: sale.saleDate,
          paymentMethod: sale.paymentMethod,
          total: sale.total,
          note: sale.note,
          bankLine: settings.bank_account
            ? `โอนเข้าบัญชีร้าน ${settings.bank_name} ${settings.bank_account}${settings.bank_account_name ? ` (${settings.bank_account_name})` : ""}`
            : null,
          items: sale.items,
        }}
        settings={settings}
        fileBase={`ใบขาย-${no}`}
        shareTitle={`ใบขาย ${no}`}
        aside={
          <>
            <Slips target={{ saleId: sale.id }} items={slips.filter((s) => s.kind === "bill")} kind="bill" title="บิล / ใบรับของจากผู้ซื้อ" />
            <Slips target={{ saleId: sale.id }} items={slips.filter((s) => s.kind === "slip")} title="สลิป / หลักฐานการรับเงิน" />
            <Card className="grid grid-cols-2 gap-2 p-3">
              <Link href={`/sales/${sale.id}/edit`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                <Pencil className="size-4" /> แก้ไข
              </Link>
              <Button
                variant="ghost"
                className="text-accent-600 hover:bg-accent-50"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`ลบใบขาย ${no} ? ยอดจะคืนเข้าทุนคงเหลือของ LOT`)) return;
                  setBusy(true);
                  await deleteSale(sale.id);
                  router.push("/sales");
                }}
              >
                <Trash2 className="size-4" /> ลบ
              </Button>
              <Link href="/sales/new" className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50">
                <Plus className="size-4" /> ขายรายการใหม่
              </Link>
            </Card>
          </>
        }
      />
    </>
  );
}
