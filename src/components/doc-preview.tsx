"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { A5 } from "@/lib/bill";
import type { ShopSettings } from "@/lib/types";
import { useImageDataUrl } from "@/lib/use-image-data-url";
import { useLineQr } from "@/lib/use-line-qr";
import { usePreviewWidth } from "@/lib/use-preview-width";
import { TradeDocA5, type TradeDoc } from "./trade-doc-a5";

/** Full-screen look at the A5 document the form will produce, before saving. */
export function DocPreview({ doc, settings, onClose }: { doc: TradeDoc; settings: ShopSettings; onClose: () => void }) {
  const w = usePreviewWidth(560, 32);
  const { qr } = useLineQr(settings, 300);
  const logo = useImageDataUrl(settings.logo_image);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="ตัวอย่างเอกสาร">
      <div className="mx-auto w-fit" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between text-white">
          <span className="text-sm">ตัวอย่าง (ยังไม่บันทึก)</span>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="ปิดตัวอย่าง">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-hidden rounded-xl shadow-2xl" style={{ width: w, height: (w / A5.width) * A5.height }}>
          <div style={{ transform: `scale(${w / A5.width})`, transformOrigin: "top left" }}>
            <TradeDocA5 doc={doc} settings={settings} qr={qr} logo={logo.url} />
          </div>
        </div>
      </div>
    </div>
  );
}
