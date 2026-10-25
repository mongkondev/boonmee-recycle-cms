"use client";

import { ImagePlus, LoaderCircle, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, Card, FormError, Input, Label, Select, Toggle } from "@/components/ui";
import { saveProduct, uploadImage } from "@/lib/actions";
import type { CategoryTree, Unit } from "@/lib/types";

export type ProductFormValue = {
  id?: number;
  title: string;
  description: string;
  price: string;
  priceNote: string;
  unitId: string;
  mainCategoryId: string;
  subCategoryId: string;
  isActive: boolean;
  imageId: string | null;
};

/** Downscale to max 800px WebP in the browser so uploads stay small. */
async function shrinkImage(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  return blob ? new File([blob], "image.webp", { type: "image/webp" }) : file;
}

export function ProductForm({ initial, tree, units }: { initial: ProductFormValue; tree: CategoryTree; units: Unit[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => setV((s) => ({ ...s, [k]: val }));

  const subs = tree.find((m) => String(m.id) === v.mainCategoryId)?.subs ?? [];

  const onFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    try {
      const fd = new FormData();
      fd.set("file", await shrinkImage(file));
      const res = await uploadImage(fd);
      if (res.ok) set("imageId", res.data!.id);
      else setError(res.error);
    } catch {
      setError("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const price = Number(v.price.replace(/,/g, ""));
    if (!v.title.trim()) return setError("กรุณากรอกหัวข้อ");
    if (v.price.trim() === "" || !Number.isFinite(price)) return setError("กรุณากรอกราคาเป็นตัวเลข");
    if (!v.subCategoryId) return setError("กรุณาเลือกหมวดหมู่ย่อย");
    startSave(async () => {
      const res = await saveProduct({
        id: v.id,
        title: v.title,
        description: v.description,
        price,
        priceNote: v.priceNote,
        unitId: v.unitId ? Number(v.unitId) : null,
        subCategoryId: Number(v.subCategoryId),
        isActive: v.isActive,
        imageId: v.imageId,
      });
      if (!res.ok) return setError(res.error);
      router.push("/products");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="space-y-5 p-6">
        <div>
          <Label htmlFor="title" required>หัวข้อ</Label>
          <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="เช่น บอร์ด-2ชิป+การ์ดจอ" autoFocus />
        </div>
        <div>
          <Label htmlFor="description">รายละเอียด</Label>
          <textarea
            id="description"
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            placeholder="ไม่บังคับ — เงื่อนไขการรับซื้อ สภาพสินค้า ฯลฯ"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="price" required>ราคา (บาท)</Label>
            <Input id="price" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.,]/g, ""))} className="text-right font-semibold tabular-nums" placeholder="0" />
          </div>
          <div>
            <Label htmlFor="unit">หน่วย</Label>
            <Select id="unit" value={v.unitId} onChange={(e) => set("unitId", e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="priceNote">ข้อความราคาบนเมนู</Label>
            <Input id="priceNote" value={v.priceNote} onChange={(e) => set("priceNote", e.target.value)} placeholder="เช่น 3000-30000, 100+" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="main" required>หมวดหมู่หลัก</Label>
            <Select id="main" value={v.mainCategoryId} onChange={(e) => setV((s) => ({ ...s, mainCategoryId: e.target.value, subCategoryId: "" }))}>
              <option value="">— เลือก —</option>
              {tree.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="sub" required>หมวดหมู่ย่อย</Label>
            <Select id="sub" value={v.subCategoryId} onChange={(e) => set("subCategoryId", e.target.value)} disabled={!v.mainCategoryId}>
              <option value="">— เลือก —</option>
              {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>
        <FormError message={error} />
        <div className="flex gap-2 border-t border-slate-100 pt-5">
          <Button type="submit" disabled={saving || uploading}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} บันทึก
          </Button>
          <Link href="/products" className="inline-flex h-10 items-center rounded-lg px-4 text-sm text-slate-600 hover:bg-slate-100">ยกเลิก</Link>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-5">
          <Label>รูปสินค้า</Label>
          <div className="relative mt-1 aspect-square overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
            {v.imageId ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${v.imageId}`} alt="" className="size-full object-cover" />
                <button type="button" onClick={() => set("imageId", null)} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80" title="ลบรูป">
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 text-slate-400 hover:text-brand-600">
                {uploading ? <LoaderCircle className="size-8 animate-spin" /> : <ImagePlus className="size-8" />}
                <span className="text-sm">{uploading ? "กำลังอัปโหลด…" : "คลิกเพื่อเลือกรูป (ไม่บังคับ)"}</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          {v.imageId && (
            <Button type="button" variant="secondary" size="sm" className="mt-3 w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
              เปลี่ยนรูป
            </Button>
          )}
        </Card>
        <Card className="flex items-center justify-between p-5">
          <div>
            <div className="text-sm font-medium text-slate-700">สถานะรับซื้อ</div>
            <div className="text-xs text-slate-400">{v.isActive ? "แสดงบนเมนูราคา" : "ซ่อนจากเมนูราคา"}</div>
          </div>
          <Toggle checked={v.isActive} onChange={(x) => set("isActive", x)} label="สถานะรับซื้อ" />
        </Card>
      </div>
    </form>
  );
}
