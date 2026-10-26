"use client";

import { ArrowLeft, CheckCircle2, FileCheck2, FileDown, ImageDown, LoaderCircle, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BillA5 } from "@/components/bill-a5";
import { Button, Card, PageHeader } from "@/components/ui";
import { deleteBill, issueBill } from "@/lib/bill-actions";
import { A5, fmtBillNo, fmtMoney, PAYMENT_LABEL } from "@/lib/bill";
import type { BillDetail } from "@/lib/queries";
import { dataUrlToFile, downloadUrl, imagesToPdf, renderNode, shareFilesNow } from "@/lib/render-image";
import type { ShopSettings } from "@/lib/types";
import { usePreviewWidth } from "@/lib/use-preview-width";

export function BillView({ bill, settings, fresh }: { bill: BillDetail; settings: ShopSettings; fresh: boolean }) {
  const router = useRouter();
  const PREVIEW_W = usePreviewWidth(520);
  const ref = useRef<HTMLDivElement>(null);
  // the JPEG is rendered once up front so the share tap can call navigator.share immediately (iOS rule)
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const issued = bill.billNo !== null;
  const no = issued ? fmtBillNo(bill.billNo!) : `#${bill.id}`;
  const fileBase = `บิลรับซื้อ-${no}`;
  const billKey = JSON.stringify(bill);

  useEffect(() => setCanShare("canShare" in navigator), []);
  useEffect(() => {
    if (!issued) return;
    let cancelled = false;
    setImage(null);
    setFailed(false);
    (async () => {
      try {
        const url = await renderNode(ref.current!, { width: A5.width, height: A5.height, pixelRatio: 2, type: "jpeg" });
        const file = await dataUrlToFile(url, `${fileBase}.jpg`);
        if (!cancelled) setImage({ url, file });
      } catch (e) {
        console.error(e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [billKey, fileBase, issued]);

  const remove = async () => {
    if (!confirm(issued ? `ลบบิลเลขที่ ${no} ?` : `ลบรายการรับซื้อ ${no} ?`)) return;
    setBusy("delete");
    await deleteBill(bill.id);
    router.push("/bills");
  };

  const preparing = !image && !failed;

  return (
    <>
      <PageHeader
        title={issued ? `บิลเลขที่ ${no}` : `รายการรับซื้อ ${no}`}
        description={`${bill.customerName ?? "ไม่ระบุชื่อลูกค้า"} · ${bill.items.length} รายการ · จ่าย${PAYMENT_LABEL[bill.paymentMethod]}`}
        actions={
          <Link href="/bills" className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="size-4" /> ทั้งหมด
          </Link>
        }
      />

      {fresh && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <CheckCircle2 className="size-5 shrink-0" />
          {issued ? "บันทึกบิลแล้ว — ส่งรูปหรือ PDF ให้ลูกค้าได้เลย" : "บันทึกรับซื้อเข้าสต็อกแล้ว — ออกบิลทีหลังได้จากหน้านี้"}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card className="space-y-2 p-5">
            <div className="mb-2">
              <div className="text-sm text-slate-500">รวมทั้งหมด</div>
              <div className="text-3xl font-bold text-ink-900 tabular-nums">{fmtMoney(bill.total)} <span className="text-base font-normal text-slate-400">บาท</span></div>
            </div>
            {!issued && (
              <>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">ยังไม่ได้ออกบิล — รายการนี้นับเข้าสต็อกแล้ว</p>
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
            )}
            {issued && canShare && (
              <Button className="w-full" disabled={!image} onClick={() => image && shareFilesNow([image.file], `บิลรับซื้อ ${no}`)}>
                {preparing ? <LoaderCircle className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                {preparing ? "กำลังเตรียมรูป…" : "แชร์รูปให้ลูกค้า (LINE)"}
              </Button>
            )}
            {issued && (
              <>
                <Button variant={canShare ? "secondary" : "primary"} className="w-full" disabled={!image} onClick={() => image && downloadUrl(image.url, `${fileBase}.jpg`)}>
                  <ImageDown className="size-4" /> บันทึกรูป (JPG)
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!image || !!busy}
                  onClick={async () => {
                    if (!image) return;
                    setBusy("pdf");
                    try {
                      await imagesToPdf([image.url], `${fileBase}.pdf`, "a5");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === "pdf" ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />} ดาวน์โหลด PDF (A5)
                </Button>
                {failed && <p className="text-center text-xs text-accent-600">สร้างรูปไม่สำเร็จ ลองรีเฟรชหน้า</p>}
                <p className="text-xs text-slate-400">ขนาด A5 1748×2480 px (300 dpi) พิมพ์ได้ชัด ส่งในแชทได้</p>
              </>
            )}
          </Card>
          <Card className="grid grid-cols-2 gap-2 p-3">
            <Link href={`/bills/${bill.id}/edit`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <Pencil className="size-4" /> แก้ไข
            </Link>
            <Button variant="ghost" className="text-accent-600 hover:bg-accent-50" disabled={!!busy} onClick={remove}>
              <Trash2 className="size-4" /> ลบ
            </Button>
            <Link href="/bills/new" className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50">
              <Plus className="size-4" /> รับซื้อรายการใหม่
            </Link>
          </Card>
        </div>

        <div>
          <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-slate-200" style={{ width: PREVIEW_W, height: (PREVIEW_W / A5.width) * A5.height }}>
            <div style={{ transform: `scale(${PREVIEW_W / A5.width})`, transformOrigin: "top left" }}>
              <BillA5 ref={ref} bill={bill} settings={settings} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
