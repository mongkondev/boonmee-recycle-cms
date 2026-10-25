"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Thumb, TrendBadge } from "@/components/trend";
import { Card, cn, Select, Toggle } from "@/components/ui";
import { deleteProduct, setProductActive } from "@/lib/actions";
import { fmtDate, fmtPrice, priceLabel, trendOf } from "@/lib/trend";
import type { CategoryTree, ProductRow } from "@/lib/types";

type SortKey = "default" | "title" | "price" | "change" | "updated";
const PAGE_SIZES = [20, 50, 100];

export function ProductTable({ rows, tree }: { rows: ProductRow[]; tree: CategoryTree }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [mainId, setMainId] = useState("");
  const [subId, setSubId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "default", dir: 1 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [optimistic, setOptimistic] = useState<Record<number, boolean>>({});

  const subs = tree.find((m) => String(m.id) === mainId)?.subs ?? [];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      const active = optimistic[r.id] ?? r.isActive;
      return (
        (!s || r.title.toLowerCase().includes(s) || (r.description ?? "").toLowerCase().includes(s)) &&
        (!mainId || String(r.mainCategoryId) === mainId) &&
        (!subId || String(r.subCategoryId) === subId) &&
        (status === "all" || (status === "active") === active)
      );
    });
    if (sort.key === "default") return out;
    const val = (r: ProductRow): number | string => {
      switch (sort.key) {
        case "title": return r.title;
        case "price": return r.price;
        case "change": return trendOf(r.price, r.prevPrice).pct;
        case "updated": return r.lastChanged ?? "";
        default: return 0;
      }
    };
    return [...out].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "string" ? x.localeCompare(y as string, "th") : x - (y as number)) * sort.dir;
    });
  }, [rows, q, mainId, subId, status, sort, optimistic]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const pageRows = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? (s.dir === 1 ? { key, dir: -1 } : { key: "default", dir: 1 }) : { key, dir: 1 }));

  const onToggle = (r: ProductRow, v: boolean) => {
    setOptimistic((o) => ({ ...o, [r.id]: v }));
    startTransition(async () => {
      await setProductActive(r.id, v);
      router.refresh();
    });
  };

  const onDelete = (r: ProductRow) => {
    if (!confirm(`ลบ "${r.title}" และประวัติราคาทั้งหมด?`)) return;
    startTransition(async () => {
      await deleteProduct(r.id);
      router.refresh();
    });
  };

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-3", className)}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {children}
        {sort.key === k && (sort.dir === 1 ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />)}
      </button>
    </th>
  );

  return (
    <Card>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="ค้นหาหัวข้อ / รายละเอียด…"
            className="h-10 w-full rounded-lg border border-slate-200 pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
          />
        </div>
        <Select className="w-full sm:w-48" value={mainId} onChange={(e) => { setMainId(e.target.value); setSubId(""); setPage(0); }}>
          <option value="">ทุกหมวดหลัก</option>
          {tree.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Select className="w-full sm:w-48" value={subId} onChange={(e) => { setSubId(e.target.value); setPage(0); }} disabled={!mainId}>
          <option value="">ทุกหมวดย่อย</option>
          {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select className="w-full sm:w-36" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(0); }}>
          <option value="all">ทุกสถานะ</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {/* phones: card list */}
      <ul className={cn("divide-y divide-slate-100 md:hidden", pending && "opacity-70")}>
        {pageRows.length === 0 && <li className="py-16 text-center text-slate-400">ไม่พบสินค้า</li>}
        {pageRows.map((r) => {
          const active = optimistic[r.id] ?? r.isActive;
          return (
            <li key={r.id} className="flex gap-3 p-4">
              <Thumb imageId={r.imageId} alt={r.title} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/products/${r.id}`} className="font-medium text-slate-800">{r.title}</Link>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold text-ink-900 tabular-nums">{priceLabel(r)}</div>
                    <div className="text-xs text-slate-400">{r.unitName ? `บาท/${r.unitName}` : "บาท"}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">{r.mainName}{r.subName && ` › ${r.subName}`}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TrendBadge price={r.price} prev={r.prevPrice} showPct={false} />
                  {r.draftPrice !== null && <span className="text-xs text-amber-600 tabular-nums">ร่าง {fmtPrice(r.draftPrice)}</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <Toggle checked={active} onChange={(v) => onToggle(r, v)} label="สถานะรับซื้อ" />
                    <Link href={`/products/${r.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="แก้ไข">
                      <Pencil className="size-4" />
                    </Link>
                    <button onClick={() => onDelete(r)} className="rounded-lg p-2 text-slate-500 hover:bg-accent-50 hover:text-accent-500" title="ลบ">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={cn("hidden overflow-x-auto md:block", pending && "opacity-70")}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <Th k="title" className="pl-4">สินค้า</Th>
              <th className="hidden px-3 py-3 lg:table-cell">หมวดหมู่</th>
              <Th k="price" className="text-right">ราคา</Th>
              <Th k="change">เปลี่ยนแปลง</Th>
              <Th k="updated" className="hidden xl:table-cell">อัปเดต</Th>
              <th className="px-3 py-3">สถานะ</th>
              <th className="px-3 py-3 text-right pr-4">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.length === 0 && (
              <tr><td colSpan={7} className="py-16 text-center text-slate-400">ไม่พบสินค้า</td></tr>
            )}
            {pageRows.map((r) => {
              const active = optimistic[r.id] ?? r.isActive;
              return (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pr-3 pl-4">
                    <div className="flex items-center gap-3">
                      <Thumb imageId={r.imageId} alt={r.title} size={40} />
                      <div className="min-w-0">
                        <Link href={`/products/${r.id}`} className="font-medium text-slate-800 hover:text-brand-600">{r.title}</Link>
                        <div className="text-xs text-slate-500 lg:hidden">{r.mainName}{r.subName && ` › ${r.subName}`}</div>
                        {r.description && <div className="max-w-72 truncate text-xs text-slate-400">{r.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    <div className="text-slate-700">{r.mainName}</div>
                    {r.subName && <div className="text-xs text-slate-400">› {r.subName}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-semibold text-ink-900 tabular-nums">{priceLabel(r)}</div>
                    {r.draftPrice !== null && <div className="text-xs text-amber-600 tabular-nums">ร่าง {fmtPrice(r.draftPrice)}</div>}
                    <div className="text-xs text-slate-400">{r.unitName ? `บาท/${r.unitName}` : "บาท"}</div>
                  </td>
                  <td className="px-3 py-2.5"><TrendBadge price={r.price} prev={r.prevPrice} /></td>
                  <td className="hidden px-3 py-2.5 text-xs text-slate-500 xl:table-cell">{fmtDate(r.lastChanged)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Toggle checked={active} onChange={(v) => onToggle(r, v)} label="สถานะรับซื้อ" />
                      <span className={cn("hidden text-xs lg:inline", active ? "text-brand-600" : "text-slate-400")}>{active ? "Active" : "Inactive"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 pl-3 text-right whitespace-nowrap">
                    <Link href={`/products/${r.id}`} className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-600" title="แก้ไข">
                      <Pencil className="size-4" />
                    </Link>
                    <button onClick={() => onDelete(r)} className="rounded-lg p-2 text-slate-500 hover:bg-accent-50 hover:text-accent-500" title="ลบ">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          แสดง
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="rounded-md border border-slate-200 px-2 py-1">
            {PAGE_SIZES.map((n) => <option key={n}>{n}</option>)}
          </select>
          รายการ · {filtered.length ? current * pageSize + 1 : 0}–{Math.min((current + 1) * pageSize, filtered.length)} จาก {filtered.length}
        </div>
        <div className="flex items-center gap-1">
          <button disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
          <span className="px-2 tabular-nums">{current + 1} / {pages}</span>
          <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"><ChevronRight className="size-4" /></button>
        </div>
      </div>
    </Card>
  );
}
