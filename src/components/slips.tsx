"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/actions";
import { addAttachment, deleteAttachment, type AttachTarget } from "@/lib/attachment-actions";
import { shrinkImage } from "@/lib/shrink-image";
import { Card, FormError } from "./ui";

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
        fd.set("file", await shrinkImage(f));
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

/** Slip photos chosen inside a buy / sell form: uploaded right away, linked when the form is saved. */
export function SlipField({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(undefined);
    const ids = [...value];
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", await shrinkImage(f));
        const res = await uploadImage(fd);
        if (!res.ok) throw new Error(res.error);
        ids.push(res.data!.id);
        onChange([...ids]);
      }
    } catch (e) {
      setError((e as Error).message || "อัพโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((id) => (
          <div key={id} className="relative size-20 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
            <a href={`/api/images/${id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${id}`} alt="สลิป" className="size-full object-cover" />
            </a>
            <button
              type="button"
              aria-label="เอาสลิปออก"
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/55 text-white hover:bg-accent-500"
              onClick={() => onChange(value.filter((v) => v !== id))}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {busy ? "อัพโหลด…" : "แนบสลิป"}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <FormError message={error} />
    </div>
  );
}
