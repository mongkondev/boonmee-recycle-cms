import { fmtPrice, trendOf } from "@/lib/trend";
import { cn } from "./ui";

/** Oil-price style indicator: ▲ +20 / ▼ -10 / ● คงที่ */
export function TrendBadge({ price, prev, showPct = true }: { price: number; prev: number | null; showPct?: boolean }) {
  const t = trendOf(price, prev);
  if (t.dir === "new")
    return <span className="inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-600 ring-1 ring-sky-100">ใหม่</span>;
  if (t.dir === "flat")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
        <span className="text-[8px]">●</span> คงที่
      </span>
    );
  const up = t.dir === "up";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1",
        up ? "bg-green-50 text-up ring-green-100" : "bg-red-50 text-down ring-red-100",
      )}
      title={`จาก ${fmtPrice(prev!)} เป็น ${fmtPrice(price)}`}
    >
      <span className="text-[10px]">{up ? "▲" : "▼"}</span>
      {up ? "+" : "−"}
      {fmtPrice(Math.abs(t.diff))}
      {showPct && <span className="font-normal opacity-70">({Math.abs(t.pct).toFixed(1)}%)</span>}
    </span>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return <span className="text-xs text-slate-300">—</span>;
  const w = 72;
  const h = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)]);
  const last = values.at(-1)!;
  const prev = values.at(-2)!;
  const color = last > prev ? "var(--color-up)" : last < prev ? "var(--color-down)" : "#94a3b8";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.2" fill={color} />
    </svg>
  );
}

export function Thumb({ imageId, alt, size = 36 }: { imageId: string | null; alt: string; size?: number }) {
  if (!imageId)
    return (
      <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-600">
        {alt.slice(0, 1)}
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/images/${imageId}`} alt={alt} width={size} height={size} style={{ width: size, height: size }} className="shrink-0 rounded-lg object-cover ring-1 ring-slate-200" loading="lazy" />
  );
}
