"use client";

import { Clock, Globe, Phone } from "lucide-react";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { fmtPrice, trendOf } from "@/lib/trend";
import type { ProductRow, ShopSettings } from "@/lib/types";

export const POSTER_W = 1080;
export const POSTER_H = 1920;
const MAX_SCALE = 1.3;
const MIN_SCALE = 0.6;

export type PosterOptions = {
  columns: "auto" | 1 | 2;
  showUnit: boolean;
  showTrend: boolean;
  showDate: boolean;
};

export type PosterData = {
  mainName: string;
  sections: { name: string; items: ProductRow[] }[];
};

const RecycleMark = ({ size, className, style }: { size: number; className?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M24 20l5-8a3 3 0 0 1 5 0l5 8" />
    <path d="M36 17l3 3-4 1" />
    <path d="M45 31l5 8a3 3 0 0 1-2.6 4.5H38" />
    <path d="M41 47l-3-3.5 3-3" />
    <path d="M26 43.5H16.6A3 3 0 0 1 14 39l5-8" />
    <path d="M15 31.5l4-.5 1 4" />
  </svg>
);

/**
 * 1080×1920 story-format price board. Rendered at native size; the preview scales a wrapper,
 * so html-to-image always captures full resolution.
 */
export const Poster = forwardRef<HTMLDivElement, { data: PosterData; settings: ShopSettings; qr: string | null; options: PosterOptions }>(
  function Poster({ data, settings, qr, options }, ref) {
    const bodyRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(MAX_SCALE);
    const total = data.sections.reduce((a, s) => a + s.items.length, 0);
    const twoCol = options.columns === "auto" ? total > 14 : options.columns === 2;

    // start large and shrink type until everything fits the fixed poster (no row overflow, no vertical overflow)
    useLayoutEffect(() => {
      setScale(MAX_SCALE);
    }, [data, options]);
    useLayoutEffect(() => {
      const el = bodyRef.current;
      if (!el || scale <= MIN_SCALE) return;
      const tooTall = el.scrollHeight > el.clientHeight + 1;
      const tooWide = [...el.querySelectorAll("li")].some((li) => li.scrollWidth > li.clientWidth + 1);
      if (tooTall || tooWide) setScale((s) => Math.max(MIN_SCALE, +(s - 0.04).toFixed(2)));
    }, [scale, data, options]);

    const phones = settings.phones.split(",").map((s) => s.trim()).filter(Boolean);
    const today = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

    return (
      <div
        ref={ref}
        style={{ width: POSTER_W, height: POSTER_H, fontFamily: "var(--font-prompt), sans-serif" }}
        className="relative flex flex-col overflow-hidden bg-[#f6f8f3] text-[#0f2a1d]"
      >
        {/* background texture */}
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#3a9e1d22 1.6px, transparent 1.6px)", backgroundSize: "28px 28px" }} />
        <RecycleMark size={760} className="absolute -right-56 bottom-40 text-[#3a9e1d]" style={{ opacity: 0.05 }} />

        {/* header */}
        <header className="relative mx-10 mt-10 overflow-hidden rounded-[44px] bg-gradient-to-br from-[#0b4a35] via-[#063a28] to-[#003020] px-12 py-11 text-white shadow-[0_24px_60px_-20px_rgba(0,48,32,0.6)]">
          <div className="absolute -top-24 -right-16 size-80 rounded-full bg-[#3a9e1d]/30 blur-2xl" />
          <RecycleMark size={300} className="absolute -right-10 -bottom-20 text-white" style={{ opacity: 0.06 }} />
          <div className="relative flex items-center gap-10">
            <div className="flex shrink-0 flex-col items-center rounded-[28px] bg-white p-4 shadow-lg">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="" width={190} height={190} className="size-[190px]" />
              ) : (
                <RecycleMark size={190} className="text-[#3a9e1d]" />
              )}
              {qr && <div className="mt-2 rounded-full bg-[#06c755] px-4 py-0.5 text-[22px] font-semibold text-white">LINE</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[26px] font-medium tracking-wide text-[#8fd074]">รับซื้อของเก่า · ให้ราคาดี</div>
              <h1 className="mt-1 text-[76px] leading-[1.1] font-bold">{settings.shop_name}</h1>
              {settings.tagline && <p className="mt-3 text-[27px] leading-snug text-white/80">{settings.tagline}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                {phones.map((p) => (
                  <span key={p} className="inline-flex items-center gap-2 rounded-full bg-white/12 px-5 py-2 text-[30px] font-semibold ring-1 ring-white/20">
                    <Phone className="size-7 text-[#8fd074]" strokeWidth={2.4} /> {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* title */}
        <div className="relative mx-14 mt-10 flex items-end justify-between gap-6">
          <div>
            <div className="text-[28px] font-medium text-[#3a9e1d]">ราคารับซื้อ</div>
            <h2 className="text-[64px] leading-none font-bold text-[#003020]">{data.mainName}</h2>
          </div>
          {options.showDate && (
            <div className="rounded-2xl bg-white px-6 py-3 text-right shadow-sm ring-1 ring-[#3a9e1d]/20">
              <div className="text-[20px] text-slate-500">อัปเดตราคา</div>
              <div className="text-[28px] font-semibold text-[#003020]">{today}</div>
            </div>
          )}
        </div>

        {/* price list */}
        <div ref={bodyRef} className="relative mx-10 mt-8 flex min-h-0 flex-1 flex-col justify-center-safe overflow-hidden">
          <div
            style={{ fontSize: 34 * scale, columnCount: twoCol ? 2 : 1, columnGap: 28 }}
            className="h-fit"
          >
            {data.sections.map((sec) => (
              <section key={sec.name} className="mb-[0.7em] break-inside-avoid-column rounded-[32px] bg-white/90 p-[0.55em] shadow-[0_8px_30px_-12px_rgba(0,48,32,0.18)] ring-1 ring-[#3a9e1d]/10">
                <div className="mb-[0.25em] flex items-center gap-3 rounded-[24px] bg-gradient-to-r from-[#3a9e1d] to-[#64b947] px-[0.6em] py-[0.25em] text-white">
                  <RecycleMark size={34 * scale} className="shrink-0 text-white/90" />
                  <span className="text-[1.05em] font-bold">{sec.name}</span>
                </div>
                <ul>
                  {sec.items.map((p, i) => {
                    const t = trendOf(p.price, p.prevPrice);
                    return (
                      <li key={p.id} className={`flex items-baseline gap-[0.3em] rounded-xl px-[0.4em] py-[0.12em] ${i % 2 ? "bg-[#f0f9ec]/70" : ""}`}>
                        <span className="font-medium whitespace-nowrap">{p.title}</span>
                        <span className="mx-[0.1em] min-w-[0.8em] flex-1 translate-y-[-0.2em] border-b-[3px] border-dotted border-[#3a9e1d]/35" />
                        {options.showTrend && (t.dir === "up" || t.dir === "down") && (
                          <span className={`text-[0.55em] ${t.dir === "up" ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{t.dir === "up" ? "▲" : "▼"}</span>
                        )}
                        <span className="font-bold whitespace-nowrap text-[#e2572c] tabular-nums">{p.priceNote || fmtPrice(p.price)}</span>
                        {options.showUnit && p.unitName && <span className="text-[0.6em] whitespace-nowrap text-slate-500">/{p.unitName}</span>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>

        {/* footer */}
        <footer className="relative mt-6 bg-[#003020] px-14 pt-8 pb-7 text-white">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-[28px] font-medium whitespace-nowrap">
              <span className="grid size-13 place-items-center rounded-full bg-[#3a9e1d]">
                <Clock className="size-7" strokeWidth={2.4} />
              </span>
              {settings.open_hours}
            </div>
            {settings.website && (
              <div className="flex items-center gap-2 text-[26px] whitespace-nowrap text-[#8fd074]">
                <Globe className="size-6" /> {settings.website}
              </div>
            )}
          </div>
          <div className="mt-4 border-t border-white/10 pt-3 text-center text-[19px] text-white/55">
            * ราคาอาจเปลี่ยนแปลงตามสภาพสินค้าและราคาตลาด · สอบถามราคาล่าสุดได้ทางโทรศัพท์หรือ LINE
          </div>
        </footer>
      </div>
    );
  },
);
