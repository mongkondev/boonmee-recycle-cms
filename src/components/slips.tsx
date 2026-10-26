"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addAttachment, deleteAttachment, type AttachTarget } from "@/lib/attachment-actions";
import { Card, FormError } from "./ui";

/** Phone photos are several MB: shrink to ≤1600px JPEG before upload. */
async function shrink(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.85));
  return new File([blob], "slip.jpg", { type: "image/jpeg" });
}

/** Payment slips attached to a purchase or sale: thumbnails, add, remove. */
export function Slips({ target, items }: { target: AttachTarget; items: { id: number; imageId: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(undefined);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", await shrink(f));
        const res = await addAttachment(target, fd);
        if (!res.ok) throw new Error(res.error);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "อัพโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-ink-900">สลิป / หลักฐานการจ่าย</span>
        <span className="text-xs text-slate-400">{items.length} รูป</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((a) => (
          <div key={a.id} className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
            <a href={`/api/images/${a.imageId}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${a.imageId}`} alt="สลิป" className="size-full object-cover" />
            </a>
            <button
              type="button"
              aria-label="ลบสลิป"
              className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/55 text-white hover:bg-accent-500"
              onClick={async () => {
                if (!confirm("ลบสลิปนี้?")) return;
                await deleteAttachment(a.id);
                router.refresh();
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {busy ? "กำลังอัพโหลด" : "แนบสลิป"}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </Card>
  );
}
