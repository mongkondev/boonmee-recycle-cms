"use client";

import { Check, CornerDownLeft, LoaderCircle, Save, Search, TriangleAlert } from "lucide-react";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { Sparkline, Thumb, TrendBadge } from "@/components/trend";
import { Button, Card, cn, Toggle } from "@/components/ui";
import { updatePrice } from "@/lib/actions";
import { fmtDate, fmtPrice, trendOf } from "@/lib/trend";
import type { ProductRow } from "@/lib/types";

type RowStatus = { state: "saving" | "saved" | "error"; message?: string; at: number };

const omit = <T,>(o: Record<number, T>, id: number) => {
  const { [id]: _removed, ...rest } = o; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
};

const parsePrice = (s: string) => {
  const n = Number(s.replace(/[,\s฿]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function PriceGrid({ initial }: { initial: ProductRow[] }) {
  const [rows, setRows] = useState(initial);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Record<number, RowStatus>>({});
  const [query, setQuery] = useState("");
  const [mainId, setMainId] = useState<number | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const inputs = useRef(new Map<number, HTMLInputElement>());

  const mains = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => m.set(r.mainCategoryId, r.mainName));
    return [...m];
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (showInactive || (r.isActive && r.subActive && r.mainActive)) &&
        (mainId === "all" || r.mainCategoryId === mainId) &&
        (!q || r.title.toLowerCase().includes(q) || r.subName.toLowerCase().includes(q)),
    );
  }, [rows, query, mainId, showInactive]);

  const dirtyIds = Object.keys(drafts)
    .map(Number)
    .filter((id) => {
      const row = rows.find((r) => r.id === id);
      const v = parsePrice(drafts[id]);
      return row && v !== null && v !== row.price;
    });

  const focusRow = useCallback(
    (fromId: number, delta: number) => {
      const idx = visible.findIndex((r) => r.id === fromId);
      const next = visible[idx + delta];
      if (!next) return;
      const el = inputs.current.get(next.id);
      el?.focus();
      el?.select();
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [visible],
  );

  const save = useCallback(
    async (id: number) => {
      const row = rows.find((r) => r.id === id);
      const raw = drafts[id];
      if (!row || raw === undefined) return true;
      const value = parsePrice(raw);
      if (value === null) {
        setStatus((s) => ({ ...s, [id]: { state: "error", message: "ราคาไม่ถูกต้อง", at: Date.now() } }));
        return false;
      }
      if (value === row.price) {
        setDrafts((d) => omit(d, id));
        return true;
      }
      setStatus((s) => ({ ...s, [id]: { state: "saving", at: Date.now() } }));
      try {
        const res = await updatePrice(id, value);
        if (!res.ok) {
          setStatus((s) => ({ ...s, [id]: { state: "error", message: res.error, at: Date.now() } }));
          return false;
        }
        const d = res.data!;
        setRows((rs) =>
          rs.map((r) =>
            r.id === id && d.changedAt
              ? { ...r, price: d.price, prevPrice: d.prevPrice, lastChanged: d.changedAt, spark: [...r.spark, d.price].slice(-10) }
              : r,
          ),
        );
        setDrafts((d) => omit(d, id));
        setStatus((s) => ({ ...s, [id]: { state: "saved", at: Date.now() } }));
        return true;
      } catch {
        setStatus((s) => ({ ...s, [id]: { state: "error", message: "บันทึกไม่สำเร็จ ลองใหม่", at: Date.now() } }));
        return false;
      }
    },
    [rows, drafts],
  );

  const saveAll = async () => {
    for (const id of dirtyIds) await save(id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: ProductRow) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // move first so typing can continue while the save is in flight
      focusRow(row.id, e.shiftKey ? -1 : 1);
      void save(row.id);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(row.id, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(row.id, -1);
    } else if (e.key === "Escape") {
      setDrafts((d) => omit(d, row.id));
      setStatus((d) => omit(d, row.id));
    }
  };

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const active = rows.filter((r) => r.isActive);
    return {
      total: active.length,
      today: rows.filter((r) => r.lastChanged && new Date(r.lastChanged).toDateString() === today && r.prevPrice !== null).length,
      up: active.filter((r) => trendOf(r.price, r.prevPrice).dir === "up").length,
      down: active.filter((r) => trendOf(r.price, r.prevPrice).dir === "down").length,
    };
  }, [rows]);

  // group visible rows: main → sub
  let lastMain = -1;
  let lastSub = -1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="สินค้าที่เปิดรับซื้อ" value={stats.total} />
        <Stat label="ปรับราคาวันนี้" value={stats.today} tone="brand" />
        <Stat label="ราคาขึ้น (ล่าสุด)" value={stats.up} tone="up" prefix="▲" />
        <Stat label="ราคาลง (ล่าสุด)" value={stats.down} tone="down" prefix="▼" />
      </div>

      <Card className="z-10 flex md:sticky md:top-16 flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาสินค้า / หมวดย่อย…"
            className="h-9 w-full rounded-lg border border-slate-200 pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[["all", "ทั้งหมด"] as const, ...mains].map(([id, name]) => (
            <button
              key={id}
              onClick={() => setMainId(id)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm transition",
                mainId === id ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Toggle checked={showInactive} onChange={setShowInactive} label="แสดงรายการปิดรับซื้อ" />
          แสดง inactive
        </label>
        <Button onClick={saveAll} disabled={!dirtyIds.length} size="sm" className="h-9">
          <Save className="size-4" /> บันทึกทั้งหมด{dirtyIds.length ? ` (${dirtyIds.length})` : ""}
        </Button>
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="size-3" /> Enter
          </Kbd>
          บันทึก + แถวถัดไป
        </span>
        <span><Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> บันทึก + แถวก่อนหน้า</span>
        <span><Kbd>↑</Kbd><Kbd>↓</Kbd> เลื่อนแถว</span>
        <span><Kbd>Esc</Kbd> ยกเลิกการแก้ไข</span>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full md:min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="hidden w-12 px-4 py-3 md:table-cell">#</th>
              <th className="px-2 py-3">สินค้า</th>
              <th className="hidden md:table-cell w-24 px-2 py-3">หน่วย</th>
              <th className="hidden md:table-cell w-28 px-2 py-3 text-right">ราคาก่อนหน้า</th>
              <th className="w-36 px-2 py-3">เปลี่ยนแปลง</th>
              <th className="hidden md:table-cell w-24 px-2 py-3">แนวโน้ม</th>
              <th className="w-32 px-2 py-3 text-right md:w-44">ราคาปัจจุบัน (บาท)</th>
              <th className="w-10 px-2 py-3" />
              <th className="hidden md:table-cell w-36 px-4 py-3">อัปเดตล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="py-16 text-center text-slate-400">ไม่พบรายการ</td>
              </tr>
            )}
            {visible.map((r, i) => {
              const header = (
                <>
                  {r.mainCategoryId !== lastMain && (
                    <tr className="bg-ink-900 text-white">
                      <td colSpan={9} className="px-4 py-2 text-sm font-medium">
                        {r.mainName}
                      </td>
                    </tr>
                  )}
                  {r.subCategoryId !== lastSub && (
                    <tr className="border-b border-brand-100 bg-brand-50">
                      <td colSpan={9} className="px-4 py-1.5 text-xs font-semibold text-brand-700">
                        <span className="mr-2 inline-block size-1.5 rounded-full bg-brand-500 align-middle" />
                        {r.subName}
                      </td>
                    </tr>
                  )}
                </>
              );
              lastMain = r.mainCategoryId;
              lastSub = r.subCategoryId;
              const draft = drafts[r.id];
              const st = status[r.id];
              const draftVal = draft !== undefined ? parsePrice(draft) : null;
              const dirty = draft !== undefined && draftVal !== r.price;
              const inactive = !(r.isActive && r.subActive && r.mainActive);
              return (
                <Fragment key={r.id}>
                  {header}
                  <tr
                    key={st?.state === "saved" ? `${r.id}-${st.at}` : r.id}
                    className={cn(
                      "group border-b border-slate-100 focus-within:bg-brand-50/60",
                      st?.state === "saved" && "flash-ok",
                      inactive && "opacity-50",
                    )}
                  >
                    <td className="hidden px-4 py-2 text-xs text-slate-400 tabular-nums md:table-cell">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-3">
                        <span className="hidden sm:block"><Thumb imageId={r.imageId} alt={r.title} size={32} /></span>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 md:truncate">{r.title}</div>
                          {r.priceNote && <div className="text-xs text-slate-400">แสดงบนใบราคา: {r.priceNote}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-2 py-2 text-slate-500 md:table-cell">{r.unitName ? `บาท/${r.unitName}` : "—"}</td>
                    <td className="hidden px-2 py-2 text-right text-slate-400 tabular-nums md:table-cell">{r.prevPrice !== null ? fmtPrice(r.prevPrice) : "—"}</td>
                    <td className="px-2 py-2">
                      {dirty && draftVal !== null ? (
                        <span className="text-xs text-amber-600">
                          รอบันทึก <TrendBadge price={draftVal} prev={r.price} showPct={false} />
                        </span>
                      ) : (
                        <TrendBadge price={r.price} prev={r.prevPrice} />
                      )}
                    </td>
                    <td className="hidden px-2 py-2 md:table-cell">
                      <Sparkline values={r.spark} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        ref={(el) => {
                          if (el) inputs.current.set(r.id, el);
                          else inputs.current.delete(r.id);
                        }}
                        inputMode="decimal"
                        value={draft ?? String(r.price)}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                        onKeyDown={(e) => onKeyDown(e, r)}
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label={`ราคา ${r.title}`}
                        className={cn(
                          "h-10 w-full rounded-lg border bg-white px-3 text-right text-base font-semibold tabular-nums outline-none transition",
                          "focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20",
                          dirty ? "border-amber-400 bg-amber-50" : "border-slate-200",
                          st?.state === "error" && "border-accent-500 bg-accent-50",
                        )}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {st?.state === "saving" && <LoaderCircle className="size-4 animate-spin text-slate-400" />}
                      {st?.state === "saved" && !dirty && <Check className="size-4 text-brand-500" />}
                      {st?.state === "error" && (
                        <span title={st.message}>
                          <TriangleAlert className="size-4 text-accent-500" />
                        </span>
                      )}
                      {dirty && st?.state !== "saving" && st?.state !== "error" && <span className="block size-2 rounded-full bg-amber-400" title="ยังไม่บันทึก" />}
                    </td>
                    <td className="hidden px-4 py-2 text-xs text-slate-400 md:table-cell">{fmtDate(r.lastChanged)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, prefix }: { label: string; value: number; tone?: "brand" | "up" | "down"; prefix?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "brand" && "text-brand-600",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
          !tone && "text-ink-900",
        )}
      >
        {prefix && <span className="mr-1 text-base">{prefix}</span>}
        {value}
      </div>
    </Card>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[11px] text-slate-600 shadow-[0_1px_0_#e2e8f0]">
      {children}
    </kbd>
  );
}
