"use client";

import { FileDown, ImageDown, LoaderCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { A5, fmtMoney } from "@/lib/bill";
import { dataUrlToFile, downloadUrl, imagesToPdf, renderNode, shareFilesNow } from "@/lib/render-image";
import type { ShopSettings } from "@/lib/types";
import { usePreviewWidth } from "@/lib/use-preview-width";
import { TradeDocA5, type TradeDoc } from "./trade-doc-a5";
import { Button, Card } from "./ui";

/**
 * A5 document preview with share / JPG / PDF buttons. `exportable` false shows the preview only
 * (e.g. a purchase whose bill is not issued yet); `aside` goes under the buttons.
 */
export function DocExport({
  doc,
  settings,
  fileBase,
  shareTitle,
  exportable = true,
  notice,
  aside,
}: {
  doc: TradeDoc;
  settings: ShopSettings;
  fileBase: string;
  shareTitle: string;
  exportable?: boolean;
  notice?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const PREVIEW_W = usePreviewWidth(520);
  const ref = useRef<HTMLDivElement>(null);
  // the JPEG is rendered once up front so the share tap can call navigator.share immediately (iOS rule)
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const docKey = JSON.stringify(doc);

  useEffect(() => setCanShare("canShare" in navigator), []);
  useEffect(() => {
    if (!exportable) return;
    let cancelled = false;
    setImage(null);
    setFailed(false);
    (async () => {
      try {
        const url = await renderNode(ref.current!, { width: A5.width, height: A5.height, pixelRatio: 2, type: "jpeg" });
        const file = await dataUrlToFile(url, `${fileBase}.jpg`);
        if (!cancelled) setImage({ url, file });
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docKey, fileBase, exportable]);

  const preparing = exportable && !image && !failed;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        <Card className="space-y-2 p-5">
          <div className="mb-2">
            <div className="text-sm text-slate-500">รวมทั้งหมด</div>
            <div className="text-3xl font-bold text-ink-900 tabular-nums">
              {fmtMoney(doc.total)} <span className="text-base font-normal text-slate-400">บาท</span>
            </div>
          </div>
          {notice}
          {exportable && (
            <>
              {canShare && (
                <Button className="w-full" disabled={!image} onClick={() => image && shareFilesNow([image.file], shareTitle)}>
                  {preparing ? <LoaderCircle className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                  {preparing ? "กำลังเตรียมรูป…" : "แชร์รูปให้ลูกค้า (LINE)"}
                </Button>
              )}
              <Button variant={canShare ? "secondary" : "primary"} className="w-full" disabled={!image} onClick={() => image && downloadUrl(image.url, `${fileBase}.jpg`)}>
                <ImageDown className="size-4" /> บันทึกรูป (JPG)
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                disabled={!image || busy}
                onClick={async () => {
                  if (!image) return;
                  setBusy(true);
                  try {
                    await imagesToPdf([image.url], `${fileBase}.pdf`, "a5");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />} ดาวน์โหลด PDF (A5)
              </Button>
              {failed && <p className="text-center text-xs text-accent-600">สร้างรูปไม่สำเร็จ ลองรีเฟรชหน้า</p>}
              <p className="text-xs text-slate-400">ขนาด A5 1748×2480 px (300 dpi) พิมพ์ได้ชัด ส่งในแชทได้</p>
            </>
          )}
        </Card>
        {aside}
      </div>

      <div>
        <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-slate-200" style={{ width: PREVIEW_W, height: (PREVIEW_W / A5.width) * A5.height }}>
          <div style={{ transform: `scale(${PREVIEW_W / A5.width})`, transformOrigin: "top left" }}>
            <TradeDocA5 ref={ref} doc={doc} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
}
