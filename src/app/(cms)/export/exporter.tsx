"use client";

import { toPng } from "html-to-image";
import { FileDown, ImageDown, LoaderCircle, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, cn, Label, Toggle } from "@/components/ui";
import type { ProductRow, ShopSettings } from "@/lib/types";
import { Poster, POSTER_H, POSTER_W, type PosterData, type PosterOptions } from "./poster";

const PREVIEW_W = 405; // 1080 * 0.375

function group(products: ProductRow[]) {
  const mains = new Map<number, PosterData & { id: number }>();
  for (const p of products) {
    let m = mains.get(p.mainCategoryId);
    if (!m) mains.set(p.mainCategoryId, (m = { id: p.mainCategoryId, mainName: p.mainName, sections: [] }));
    let s = m.sections.find((x) => x.name === p.subName);
    if (!s) m.sections.push((s = { name: p.subName, items: [] }));
    s.items.push(p);
  }
  return [...mains.values()];
}

const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

export function Exporter({ products, settings }: { products: ProductRow[]; settings: ShopSettings }) {
  const posters = useMemo(() => group(products), [products]);
  const [selected, setSelected] = useState<number[]>(posters.map((p) => p.id));
  const [options, setOptions] = useState<PosterOptions>({ columns: "auto", showUnit: true, showTrend: false, showDate: true });
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const refs = useRef(new Map<number, HTMLDivElement>());
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare("canShare" in navigator), []);

  useEffect(() => {
    if (!settings.line_url) return setQr(null);
    QRCode.toDataURL(settings.line_url, { margin: 0, width: 380, color: { dark: "#003020" } }).then(setQr);
  }, [settings.line_url]);

  const chosen = posters.filter((p) => selected.includes(p.id));
  const fileBase = `ราคารับซื้อ-${new Date().toISOString().slice(0, 10)}`;

  const render = async (id: number) => {
    const node = refs.current.get(id)!;
    await document.fonts.ready;
    return toPng(node, { pixelRatio: 1, width: POSTER_W, height: POSTER_H, cacheBust: true, style: { transform: "none" } });
  };

  const download = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert("ส่งออกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  };

  const exportPng = (p: (typeof posters)[number]) =>
    run(`png-${p.id}`, async () => download(await render(p.id), `${fileBase}-${slug(p.mainName)}.png`));

  const exportPdf = () =>
    run("pdf", async () => {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "px", format: [POSTER_W, POSTER_H], hotfixes: ["px_scaling"] });
      for (const [i, p] of chosen.entries()) {
        if (i) pdf.addPage([POSTER_W, POSTER_H]);
        pdf.addImage(await render(p.id), "PNG", 0, 0, POSTER_W, POSTER_H, undefined, "FAST");
      }
      pdf.save(`${fileBase}.pdf`);
    });

  const share = () =>
    run("share", async () => {
      const files = await Promise.all(
        chosen.map(async (p) => {
          const blob = await (await fetch(await render(p.id))).blob();
          return new File([blob], `${fileBase}-${slug(p.mainName)}.png`, { type: "image/png" });
        }),
      );
      if (navigator.canShare?.({ files })) await navigator.share({ files, title: settings.shop_name });
      else files.forEach((f) => download(URL.createObjectURL(f), f.name));
    });

  const opt = <K extends keyof PosterOptions>(k: K, v: PosterOptions[K]) => setOptions((o) => ({ ...o, [k]: v }));

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
      <Card className="h-fit space-y-5 p-5 xl:sticky xl:top-22">
        <div>
          <Label>หมวดหมู่ที่จะส่งออก</Label>
          <div className="space-y-1.5">
            {posters.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-500"
                  checked={selected.includes(p.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                />
                <span className="flex-1">{p.mainName}</span>
                <span className="text-xs text-slate-400">{p.sections.reduce((a, s) => a + s.items.length, 0)}</span>
              </label>
            ))}
            {posters.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีสินค้าที่ active</p>}
          </div>
        </div>
        <div>
          <Label>รูปแบบคอลัมน์</Label>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            {(["auto", 1, 2] as const).map((c) => (
              <button
                key={c}
                onClick={() => opt("columns", c)}
                className={cn("rounded-md py-1.5 text-sm", options.columns === c ? "bg-white font-medium shadow-sm" : "text-slate-500")}
              >
                {c === "auto" ? "อัตโนมัติ" : `${c} คอลัมน์`}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3 text-sm">
          {(
            [
              ["showUnit", "แสดงหน่วย (/กก.)"],
              ["showTrend", "แสดงลูกศร ▲▼ ราคาขึ้น/ลง"],
              ["showDate", "แสดงวันที่อัปเดต"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-2">
              {label}
              <Toggle checked={options[k]} onChange={(v) => opt(k, v)} label={label} />
            </label>
          ))}
        </div>
        <div className="space-y-2 border-t border-slate-100 pt-5">
          <Button className="w-full" onClick={exportPdf} disabled={!chosen.length || !!busy}>
            {busy === "pdf" ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            ดาวน์โหลด PDF ({chosen.length} หน้า)
          </Button>
          {canShare && (
            <Button variant="secondary" className="w-full" onClick={share} disabled={!chosen.length || !!busy}>
              {busy === "share" ? <LoaderCircle className="size-4 animate-spin" /> : <Share2 className="size-4" />}
              แชร์รูป (LINE / Facebook)
            </Button>
          )}
          <p className="text-xs text-slate-400">ขนาด 1080×1920 px (สัดส่วนสตอรี่) เหมาะกับการส่งในแชท · แก้ข้อมูลร้านได้ที่หน้า ตั้งค่า</p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-6">
        {chosen.map((p) => (
          <div key={p.id} className="space-y-3">
            <div
              className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-slate-200"
              style={{ width: PREVIEW_W, height: (PREVIEW_W / POSTER_W) * POSTER_H }}
            >
              <div style={{ transform: `scale(${PREVIEW_W / POSTER_W})`, transformOrigin: "top left" }}>
                <Poster
                  ref={(el) => {
                    if (el) refs.current.set(p.id, el);
                    else refs.current.delete(p.id);
                  }}
                  data={p}
                  settings={settings}
                  qr={qr}
                  options={options}
                />
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => exportPng(p)} disabled={!!busy}>
              {busy === `png-${p.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <ImageDown className="size-4" />}
              ดาวน์โหลด PNG · {p.mainName}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
