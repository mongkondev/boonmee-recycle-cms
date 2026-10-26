"use client";

import { ArrowLeft, CheckCircle2, FileDown, ImageDown, LoaderCircle, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MenuA4Page } from "@/components/menu-a4";
import { TrendBadge } from "@/components/trend";
import { Button, Card, PageHeader } from "@/components/ui";
import { savePublicationPage, trimPublicationPages } from "@/lib/actions";
import { A4, paginate } from "@/lib/menu";
import type { getPublication } from "@/lib/queries";
import { dataUrlToFile, downloadUrl, imagesToA4Pdf, renderNode, shareFilesNow } from "@/lib/render-image";
import { fmtDate, fmtPrice } from "@/lib/trend";
import { useLineQr } from "@/lib/use-line-qr";
import { usePreviewWidth } from "@/lib/use-preview-width";

type Pub = NonNullable<Awaited<ReturnType<typeof getPublication>>>;

export function PublicationView({ pub, fresh }: { pub: Pub; fresh: boolean }) {
  const router = useRouter();
  const pages = useMemo(() => paginate(pub.snapshot), [pub.snapshot]);
  const PREVIEW_W = usePreviewWidth(360);
  const { qr, ready: qrReady } = useLineQr(pub.snapshot.settings, 300);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>();
  const [canShare, setCanShare] = useState(false);
  const refs = useRef(new Map<number, HTMLDivElement>());
  const started = useRef(false);
  const date = new Date(pub.publishedAt);
  const fileBase = `เมนูราคา-${pub.publishedAt.slice(0, 10)}-${pub.id}`;
  const stored = pub.pages.length === pages.length;

  useEffect(() => setCanShare("canShare" in navigator), []);

  /** Render each A4 page from the snapshot and store it on the server. */
  const generate = useCallback(async () => {
    setBusy("generate");
    try {
      for (const [i] of pages.entries()) {
        setProgress(`กำลังสร้างหน้า ${i + 1}/${pages.length}`);
        const url = await renderNode(refs.current.get(i)!, { width: A4.width, height: A4.height, pixelRatio: 2, type: "jpeg" });
        const fd = new FormData();
        fd.set("file", await dataUrlToFile(url, `page-${i + 1}.jpg`));
        const res = await savePublicationPage(pub.id, i + 1, fd);
        if (!res.ok) throw new Error(res.error);
      }
      await trimPublicationPages(pub.id, pages.length);
      setProgress(undefined);
      router.refresh();
    } catch (e) {
      console.error(e);
      setProgress("สร้างรูปไม่สำเร็จ กด 'สร้างรูปใหม่' เพื่อลองอีกครั้ง");
    } finally {
      setBusy(null);
    }
  }, [pages, pub.id, router]);

  // right after publishing, build the A4 images automatically
  useEffect(() => {
    if (!started.current && qrReady && !stored) {
      started.current = true;
      void generate();
    }
  }, [qrReady, stored, generate]);

  const pageUrls = pub.pages.map((p) => `/api/images/${p.imageId}`);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  // fetch the stored pages up front so the share tap can call navigator.share immediately (iOS rule)
  const [shareFiles, setShareFiles] = useState<File[] | null>(null);
  const pageKey = pub.pages.map((p) => p.imageId).join(",");
  useEffect(() => {
    if (!canShare || !pageKey) return;
    let cancelled = false;
    setShareFiles(null);
    Promise.all(pageKey.split(",").map((id, i) => dataUrlToFile(`/api/images/${id}`, `${fileBase}-${i + 1}.jpg`)))
      .then((files) => !cancelled && setShareFiles(files))
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [canShare, pageKey, fileBase]);

  return (
    <>
      <PageHeader
        title={`เมนูราคา A4 · Publish #${pub.id}`}
        description={`${fmtDate(pub.publishedAt)} · เปลี่ยนราคา ${pub.changeCount} รายการ${pub.note ? ` · ${pub.note}` : ""}`}
        actions={
          <Link href="/publications" className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="size-4" /> ทั้งหมด
          </Link>
        }
      />

      {fresh && stored && !busy && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <CheckCircle2 className="size-5" /> Publish สำเร็จ — เมนูราคา A4 {pages.length} หน้าพร้อมส่งให้ลูกค้าแล้ว
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card className="space-y-2 p-5">
            <Button className="w-full" disabled={!stored || !!busy} onClick={() => run("pdf", () => imagesToA4Pdf(pageUrls, `${fileBase}.pdf`))}>
              {busy === "pdf" ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />} ดาวน์โหลด PDF (A4 · {pages.length} หน้า)
            </Button>
            {canShare && (
              <Button
                variant="secondary"
                className="w-full"
                disabled={!stored || !shareFiles || !!busy}
                onClick={() => shareFiles && shareFilesNow(shareFiles, "เมนูราคารับซื้อ")}
              >
                {stored && !shareFiles ? <LoaderCircle className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                {stored && !shareFiles ? "กำลังเตรียมไฟล์…" : "แชร์รูป (LINE / Facebook)"}
              </Button>
            )}
            <Button variant="ghost" className="w-full" disabled={!!busy || !qrReady} onClick={generate}>
              <RefreshCw className={busy === "generate" ? "size-4 animate-spin" : "size-4"} /> สร้างรูปใหม่
            </Button>
            {progress && <p className="text-center text-xs text-slate-500">{progress}</p>}
            <p className="text-xs text-slate-400">รูป A4 ขนาด 2480×3508 px (300 dpi) พิมพ์ได้ชัด ส่งในแชทได้</p>
          </Card>

          <Card>
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink-900">ราคาที่เปลี่ยนในรอบนี้</div>
            {pub.changes.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">ไม่มีการเปลี่ยนราคา</p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {pub.changes.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="font-semibold tabular-nums">{fmtPrice(c.newPrice)}</span>
                    <TrendBadge price={c.newPrice} prev={c.oldPrice} showPct={false} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-wrap gap-6">
          {pages.map((page, i) => (
            <div key={i} className="space-y-2">
              <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-slate-200" style={{ width: PREVIEW_W, height: (PREVIEW_W / A4.width) * A4.height }}>
                <div style={{ transform: `scale(${PREVIEW_W / A4.width})`, transformOrigin: "top left" }}>
                  <MenuA4Page
                    ref={(el) => {
                      if (el) refs.current.set(i, el);
                      else refs.current.delete(i);
                    }}
                    page={page}
                    pageNo={i + 1}
                    pageCount={pages.length}
                    settings={pub.snapshot.settings}
                    qr={qr}
                    date={date}
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={!pub.pages[i] || !!busy}
                onClick={() => downloadUrl(pageUrls[i], `${fileBase}-${i + 1}.jpg`)}
              >
                <ImageDown className="size-4" /> ดาวน์โหลดหน้า {i + 1}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
