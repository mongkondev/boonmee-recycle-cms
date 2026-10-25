"use client";

import { Check, CornerDownLeft, LoaderCircle, Megaphone, Save, Search, TriangleAlert, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { PriceInput, toPriceInput } from "@/components/price-input";
import { Sparkline, Thumb, TrendBadge } from "@/components/trend";
import { Button, Card, cn, Toggle } from "@/components/ui";
import { discardDrafts, publish, saveDraft } from "@/lib/actions";
import { fmtDate, fmtPrice, fmtPriceNote, trendOf } from "@/lib/trend";
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
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [publishOpen, setPublishOpen] = useState(false);
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
        (!q || r.title.toLowerCase().includes(q) || (r.subName ?? "").toLowerCase().includes(q)),
    );
  }, [rows, query, mainId, showInactive]);

  const dirtyIds = Object.keys(drafts)
    .map(Number)
    .filter((id) => {
      const row = rows.find((r) => r.id === id);
      const v = parsePrice(drafts[id]);
      return row && v !== null && v !== (row.draftPrice ?? row.price);
    });

  const draftRows = rows.filter((r) => r.draftPrice !== null);

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
      if (value === (row.draftPrice ?? row.price)) {
        setDrafts((d) => omit(d, id));
        return true;
      }
      setStatus((s) => ({ ...s, [id]: { state: "saving", at: Date.now() } }));
      try {
        const res = await saveDraft(id, value);
        if (!res.ok) {
          setStatus((s) => ({ ...s, [id]: { state: "error", message: res.error, at: Date.now() } }));
          return false;
        }
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, draftPrice: res.data!.draftPrice } : r)));
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
    let ok = true;
    for (const id of dirtyIds) ok = (await save(id)) && ok;
    return ok;
  };

  const openPublish = async () => {
    if (dirtyIds.length && !(await saveAll())) return;
    setPublishOpen(true);
  };

  const onDiscard = async () => {
    if (!confirm(`ล้างราคาร่างทั้งหมด ${draftRows.length} รายการ? ราคาจะกลับเป็นราคาที่ประกาศอยู่`)) return;
    await discardDrafts();
    setRows((rs) => rs.map((r) => ({ ...r, draftPrice: null })));
    setDrafts({});
    setStatus({});
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
    const active = rows.filter((r) => r.isActive);
    return {
      total: active.length,
      up: active.filter((r) => trendOf(r.price, r.prevPrice).dir === "up").length,
      down: active.filter((r) => trendOf(r.price, r.prevPrice).dir === "down").length,
    };
  }, [rows]);

  // group visible rows: main → sub
  let lastMain = -1;
  let lastSub: number | null = -1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="สินค้าที่เปิดรับซื้อ" value={stats.total} />
        <Stat label="ร่างรอ Publish" value={draftRows.length} tone="draft" />
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
        <div className="flex flex-wrap gap-2">
          {draftRows.length > 0 && (
            <Button onClick={onDiscard} variant="ghost" size="sm" className="h-9" title="ล้างราคาร่างทั้งหมด">
              <Undo2 className="size-4" /> ล้างร่าง
            </Button>
          )}
          <Button onClick={saveAll} disabled={!dirtyIds.length} variant="secondary" size="sm" className="h-9">
            <Save className="size-4" /> บันทึกร่าง{dirtyIds.length ? ` (${dirtyIds.length})` : ""}
          </Button>
          <Button onClick={openPublish} size="sm" className="h-9">
            <Megaphone className="size-4" /> Publish{draftRows.length + dirtyIds.length ? ` (${draftRows.length + dirtyIds.length})` : ""}
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="size-3" /> Enter
          </Kbd>
          บันทึกร่าง + แถวถัดไป
        </span>
        <span><Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> บันทึกร่าง + แถวก่อนหน้า</span>
        <span className="text-amber-600">ราคาจะเปลี่ยนจริงเมื่อกด Publish</span>
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
              <th className="hidden md:table-cell w-28 px-2 py-3 text-right">ราคาประกาศ</th>
              <th className="w-36 px-2 py-3">เปลี่ยนแปลง</th>
              <th className="hidden md:table-cell w-24 px-2 py-3">แนวโน้ม</th>
              <th className="w-32 px-2 py-3 text-right md:w-44">ราคาใหม่ (บาท)</th>
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
                  {(r.subCategoryId !== lastSub || r.mainCategoryId !== lastMain) && r.subName && (
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
              const dirty = draft !== undefined && draftVal !== (r.draftPrice ?? r.price);
              const hasDraft = r.draftPrice !== null;
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
                          {r.priceNote && <div className="text-xs text-slate-400">แสดงบนเมนูราคา: {fmtPriceNote(r.priceNote)}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-2 py-2 text-slate-500 md:table-cell">{r.unitName ? `บาท/${r.unitName}` : "—"}</td>
                    <td className="hidden px-2 py-2 text-right text-slate-500 tabular-nums md:table-cell">{fmtPrice(r.price)}</td>
                    <td className="px-2 py-2">
                      {dirty && draftVal !== null ? (
                        <span className="text-xs text-amber-600">
                          ยังไม่บันทึก <TrendBadge price={draftVal} prev={r.price} showPct={false} />
                        </span>
                      ) : hasDraft ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">ร่าง</span>
                          <TrendBadge price={r.draftPrice!} prev={r.price} />
                        </span>
                      ) : (
                        <TrendBadge price={r.price} prev={r.prevPrice} />
                      )}
                    </td>
                    <td className="hidden px-2 py-2 md:table-cell">
                      <Sparkline values={r.spark} />
                    </td>
                    <td className="px-2 py-1.5">
                      <PriceInput
                        ref={(el) => {
                          if (el) inputs.current.set(r.id, el);
                          else inputs.current.delete(r.id);
                        }}
                        value={draft ?? toPriceInput(r.draftPrice ?? r.price)}
                        onValueChange={(v) => setDrafts((d) => ({ ...d, [r.id]: v }))}
                        onKeyDown={(e) => onKeyDown(e, r)}
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label={`ราคา ${r.title}`}
                        className={cn(
                          "h-10 w-full rounded-lg border bg-white px-3 text-right text-base font-semibold tabular-nums outline-none transition",
                          "focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20",
                          dirty ? "border-amber-400 bg-amber-50" : hasDraft ? "border-amber-300 bg-amber-50/60 text-amber-800" : "border-slate-200",
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

      {publishOpen && (
        <PublishDialog
          rows={rows.filter((r) => r.draftPrice !== null)}
          onClose={() => setPublishOpen(false)}
          onDone={(id) => router.push(`/publications/${id}?fresh=1`)}
        />
      )}
    </div>
  );
}

function PublishDialog({ rows, onClose, onDone }: { rows: ProductRow[]; onClose: () => void; onDone: (id: number) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    setBusy(true);
    const res = await publish(note);
    if (res.ok) onDone(res.data!.id);
    else {
      setError(res.error);
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <Card className="flex max-h-[85dvh] w-full max-w-lg flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Megaphone className="size-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold text-ink-900">Publish ราคาใหม่</h2>
            <p className="text-sm text-slate-500">
              {rows.length ? `เปลี่ยนราคา ${rows.length} รายการ` : "ไม่มีราคาเปลี่ยน — จะสร้างเมนูราคาจากราคาปัจจุบัน"} แล้วสร้างเมนู A4 เก็บไว้ส่งลูกค้า
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="ปิด">
            <X className="size-5" />
          </button>
        </div>
        {rows.length > 0 && (
          <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="text-slate-400 tabular-nums line-through">{fmtPrice(r.price)}</span>
                <span className="font-semibold tabular-nums">{fmtPrice(r.draftPrice!)}</span>
                <TrendBadge price={r.draftPrice!} prev={r.price} showPct={false} />
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-3 border-t border-slate-100 p-5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุ (ไม่บังคับ) เช่น ราคาทองแดงขึ้นตามตลาด"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
          {error && <p className="text-sm text-accent-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>ยกเลิก</Button>
            <Button onClick={submit} disabled={busy} autoFocus>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Megaphone className="size-4" />} ยืนยัน Publish
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, prefix }: { label: string; value: number; tone?: "draft" | "up" | "down"; prefix?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "draft" && "text-amber-600",
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
