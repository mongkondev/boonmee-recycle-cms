"use client";

import { Clock, Globe, Phone } from "lucide-react";
import { forwardRef } from "react";
import { A4, type MenuPage, type MenuRow } from "@/lib/menu";
import { fmtPriceNote } from "@/lib/trend";
import type { ShopSettings } from "@/lib/types";
import { RecycleMark } from "./recycle-mark";

type Props = {
  page: MenuPage;
  pageNo: number;
  pageCount: number;
  settings: ShopSettings;
  qr: string | null;
  date: Date;
  showUnit?: boolean;
  showTrend?: boolean;
  showImage?: boolean;
};

/** One A4 (1240×1754) menu page. Header and footer repeat on every page. */
export const MenuA4Page = forwardRef<HTMLDivElement, Props>(function MenuA4Page(
  { page, pageNo, pageCount, settings, qr, date, showUnit = true, showTrend = false, showImage = false },
  ref,
) {
  const phones = settings.phones.split(",").map((s) => s.trim()).filter(Boolean);
  const dateText = date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div
      ref={ref}
      style={{ width: A4.width, height: A4.height, fontFamily: "var(--font-prompt), sans-serif" }}
      className="relative flex flex-col overflow-hidden bg-[#f7f9f4] text-[#0f2a1d]"
    >
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#3a9e1d1f 1.4px, transparent 1.4px)", backgroundSize: "24px 24px" }} />
      <RecycleMark size={680} className="absolute -right-48 bottom-24 text-[#3a9e1d]" style={{ opacity: 0.045 }} />

      {/* header */}
      <header style={{ height: A4.header }} className="relative shrink-0 px-9 pt-9">
        <div className="relative flex h-full items-center gap-8 overflow-hidden rounded-[36px] bg-gradient-to-br from-[#0b4a35] via-[#063a28] to-[#003020] px-9 text-white">
          <div className="absolute -top-20 -right-10 size-64 rounded-full bg-[#3a9e1d]/30 blur-2xl" />
          <RecycleMark size={240} className="absolute -right-6 -bottom-16 text-white" style={{ opacity: 0.06 }} />
          <div className="relative flex shrink-0 flex-col items-center rounded-[22px] bg-white p-3">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="" className="size-[140px]" />
            ) : (
              <RecycleMark size={140} className="text-[#3a9e1d]" />
            )}
            {qr && <div className="mt-1.5 rounded-full bg-[#06c755] px-3 text-[17px] font-semibold text-white">LINE</div>}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="text-[20px] font-medium text-[#8fd074]">เมนูราคารับซื้อ</div>
            <h1 className="text-[56px] leading-[1.15] font-bold">{settings.shop_name}</h1>
            {settings.tagline && <p className="mt-1 truncate text-[21px] text-white/80">{settings.tagline}</p>}
            <div className="mt-3 flex flex-wrap gap-2.5">
              {phones.map((p) => (
                <span key={p} className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-1 text-[23px] font-semibold ring-1 ring-white/20">
                  <Phone className="size-5 text-[#8fd074]" strokeWidth={2.4} /> {p}
                </span>
              ))}
            </div>
          </div>
          <div className="relative shrink-0 self-start pt-8 text-right">
            <div className="rounded-2xl bg-white/10 px-4 py-2 ring-1 ring-white/15">
              <div className="text-[16px] text-white/60">ราคา ณ วันที่</div>
              <div className="text-[22px] font-semibold">{dateText}</div>
            </div>
          </div>
        </div>
      </header>

      {/* body */}
      <main className="relative flex-1 px-9" style={{ paddingTop: A4.bodyPadY, paddingBottom: A4.bodyPadY }}>
        {page.blocks.map((b, i) => (
          <section key={i} style={{ marginBottom: A4.blockGap }}>
            <div style={{ height: A4.pill, marginBottom: A4.pillGap }} className="flex items-center justify-center gap-4 rounded-full bg-gradient-to-r from-[#3a9e1d] via-[#4fae2f] to-[#64b947] text-white shadow-[0_10px_24px_-12px_rgba(58,158,29,0.7)]">
              <RecycleMark size={34} className="text-white/85" />
              <h2 className="text-[36px] font-bold">
                {b.mainName}
                {b.continued && <span className="ml-2 text-[22px] font-medium text-white/80">(ต่อ)</span>}
              </h2>
              <RecycleMark size={34} className="text-white/85" />
            </div>
            <div className="grid grid-cols-2 gap-8 rounded-[28px] bg-white/90 px-6 py-1 shadow-[0_8px_24px_-14px_rgba(0,48,32,0.25)] ring-1 ring-[#3a9e1d]/10">
              {b.columns.map((col, ci) => (
                <ul key={ci} className={ci === 1 ? "border-l border-dashed border-[#3a9e1d]/20 pl-8" : ""}>
                  {col.map((r, ri) => (
                    <Row key={ri} row={r} showUnit={showUnit} showTrend={showTrend} showImage={showImage} />
                  ))}
                </ul>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* footer */}
      <footer style={{ height: A4.footer }} className="relative flex shrink-0 items-center justify-between gap-6 bg-[#003020] px-12 text-white">
        <div className="flex items-center gap-3 text-[21px] font-medium whitespace-nowrap">
          <span className="grid size-10 place-items-center rounded-full bg-[#3a9e1d]">
            <Clock className="size-5.5" strokeWidth={2.4} />
          </span>
          {settings.open_hours}
        </div>
        <div className="text-center text-[15px] leading-snug text-white/55">
          * ราคาอาจเปลี่ยนแปลงตามสภาพสินค้าและราคาตลาด
          {settings.website && (
            <div className="flex items-center justify-center gap-1.5 text-[18px] text-[#8fd074]">
              <Globe className="size-4" /> {settings.website}
            </div>
          )}
        </div>
        <div className="rounded-full bg-white/10 px-4 py-1 text-[18px] whitespace-nowrap tabular-nums">
          หน้า {pageNo}/{pageCount}
        </div>
      </footer>
    </div>
  );
});

function Row({ row, showUnit, showTrend, showImage }: { row: MenuRow; showUnit: boolean; showTrend: boolean; showImage: boolean }) {
  if (row.kind === "sub")
    return (
      <li style={{ height: A4.row }} className="flex items-end gap-2 pb-1 text-[17px] font-semibold text-[#2f8217]">
        <span className="mb-1.5 size-2 rounded-full bg-[#3a9e1d]" />
        {row.name}
        <span className="mb-2.5 h-px flex-1 bg-[#3a9e1d]/25" />
      </li>
    );
  const p = row.item;
  const dir = p.prevPrice === null ? null : p.price > p.prevPrice ? "up" : p.price < p.prevPrice ? "down" : null;
  return (
    <li style={{ height: A4.row }} className="flex items-center gap-2 text-[23px]">
      {showImage &&
        (p.imageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${p.imageId}`} alt="" className="size-7 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f0f9ec] text-[#3a9e1d]">
            <RecycleMark size={16} />
          </span>
        ))}
      <span className="min-w-0 truncate font-medium">{p.title}</span>
      <span className="min-w-4 flex-1 translate-y-2 border-b-2 border-dotted border-[#3a9e1d]/35" />
      {showTrend && dir && <span className={`text-[13px] ${dir === "up" ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{dir === "up" ? "▲" : "▼"}</span>}
      <span className="font-bold whitespace-nowrap text-[#e2572c] tabular-nums">{fmtPriceNote(p.priceText)}</span>
      {showUnit && p.unitName && <span className="text-[14px] whitespace-nowrap text-slate-500">/{p.unitName}</span>}
    </li>
  );
}
