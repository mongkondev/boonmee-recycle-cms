"use client";

import { useEffect, useRef, useState } from "react";
import { fmtMoney } from "@/lib/bill";

// validated pair (dataviz validator, light surface): buy = blue, sell = brand green
const BUY = "#2a78d6";
const SELL = "#2f8217";

type Point = { day: string; buy: number; sell: number };

const compact = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n));

/** Round the axis top up to 1 / 2 / 5 × 10ⁿ so the gridlines land on even numbers. */
function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

/** Grouped bars: money bought in vs sold out per day. One axis (both are baht). */
export function BuySellChart({ data, height = 240 }: { data: Point[]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 8, right: 4, bottom: 26, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.buy, d.sell)), 0));
  const slot = plotW / data.length;
  const barW = Math.max(2, Math.min(18, (slot - 6) / 2 - 1));
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)));
  const h = hover === null ? null : data[hover];

  const bar = (x: number, v: number, color: string, dim: boolean) => {
    if (v <= 0) return null;
    const top = y(v);
    const hgt = Math.max(1, pad.top + plotH - top);
    const r = Math.min(4, barW / 2, hgt);
    // rounded data-end, square at the baseline
    return (
      <path
        d={`M${x},${top + hgt} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + hgt} Z`}
        fill={color}
        opacity={dim ? 0.45 : 1}
      />
    );
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: BUY }} /> ซื้อเข้า</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SELL }} /> ขายออก</span>
      </div>
      <div ref={box} className="relative w-full min-w-0 overflow-hidden" style={{ height }}>
        {width > 0 && <svg width={width} height={height} role="img" aria-label="กราฟยอดซื้อเข้าและขายออกรายวัน" className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#cbd5e1" : "#eef2f6"} />
              <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#64748b">{compact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.left + slot * i + slot / 2;
            const dim = hover !== null && hover !== i;
            return (
              <g key={d.day}>
                {hover === i && <rect x={cx - slot / 2} y={pad.top} width={slot} height={plotH} fill="#f1f5f9" />}
                {bar(cx - barW - 1, d.buy, BUY, dim)}
                {bar(cx + 1, d.sell, SELL, dim)}
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill="#64748b">{dayLabel(d.day)}</text>
                )}
                {/* hit target: the whole day column */}
                <rect
                  x={cx - slot / 2}
                  y={pad.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${dayLabel(d.day)} ซื้อเข้า ${fmtMoney(d.buy)} ขายออก ${fmtMoney(d.sell)} บาท`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
        </svg>}
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(0, pad.left + slot * hover + slot / 2 - 80), width - 170),
            }}
          >
            <div className="mb-1 text-slate-500">{dayLabel(h.day)}</div>
            {[
              ["ซื้อเข้า", h.buy, BUY],
              ["ขายออก", h.sell, SELL],
            ].map(([label, v, c]) => (
              <div key={label as string} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded" style={{ background: c as string }} />
                <span className="text-slate-500">{label}</span>
                <span className="ml-auto font-semibold text-slate-900 tabular-nums">{fmtMoney(v as number)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
