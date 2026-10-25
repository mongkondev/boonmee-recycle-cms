"use client";

import { FileDown, ImageDown, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { downloadUrl, imagesToA4Pdf } from "@/lib/render-image";

/** Download buttons on a publication card (the card itself links to the detail page). */
export function PubDownloads({ id, publishedAt, pageIds }: { id: number; publishedAt: string; pageIds: string[] }) {
  const [busy, setBusy] = useState(false);
  const base = `เมนูราคา-${publishedAt.slice(0, 10)}-${id}`;
  const urls = pageIds.map((p) => `/api/images/${p}`);
  if (!urls.length) return <p className="mt-3 text-xs text-amber-600">ยังไม่มีไฟล์ — เปิดเพื่อสร้างรูป</p>;
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button
        onClick={async (e) => {
          stop(e);
          setBusy(true);
          try {
            await imagesToA4Pdf(urls, `${base}.pdf`);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand-500 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />} PDF
      </button>
      <button
        onClick={(e) => {
          stop(e);
          urls.forEach((u, i) => downloadUrl(u, `${base}-${i + 1}.jpg`));
        }}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <ImageDown className="size-3.5" /> JPG ({urls.length})
      </button>
    </div>
  );
}
