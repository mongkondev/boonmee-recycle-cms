import { ChevronLeft, ChevronRight, FileImage, Megaphone, Search, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Card, cn, PageHeader } from "@/components/ui";
import { getPublications } from "@/lib/queries";
import { PubDownloads } from "./pub-downloads";
import { fmtDate } from "@/lib/trend";

export const metadata = { title: "ประกาศราคา" };

const PER_PAGE = 4;
const isDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export default async function PublicationsPage({ searchParams }: { searchParams: Promise<{ page?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const from = isDay(sp.from);
  const to = isDay(sp.to);
  const filtered = !!(from || to);
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const { total, items: pubs } = await getPublications({ page, perPage: PER_PAGE, from, to });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => `/publications?${new URLSearchParams({ ...(from && { from }), ...(to && { to }), ...(p > 1 && { page: String(p) }) })}`;
  return (
    <>
      <PageHeader title="ประวัติการ Publish" description="ทุกครั้งที่ Publish ระบบสร้างประวัติและเก็บเมนูราคา A4 ไว้ ดาวน์โหลดไฟล์รอบก่อนๆ ส่งลูกค้าได้ทุกเมื่อ" />
      <Form action="/publications" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          ตั้งแต่วันที่
          <input type="date" name="from" defaultValue={from ?? ""} className="mt-1 block h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm" />
        </label>
        <label className="text-xs text-slate-500">
          ถึงวันที่
          <input type="date" name="to" defaultValue={to ?? ""} className="mt-1 block h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm" />
        </label>
        <button className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-ink-900/90">
          <Search className="size-4" /> ค้นหา
        </button>
        {filtered && (
          <Link href="/publications" className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">
            <X className="size-4" /> ล้าง
          </Link>
        )}
        <span className="ml-auto self-center text-sm text-slate-500">ทั้งหมด {total} รายการ</span>
      </Form>
      {pubs.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Megaphone className="mx-auto mb-3 size-8" />
          {filtered || page > 1 ? (
            "ไม่พบการ Publish ในช่วงวันที่นี้"
          ) : (
            <>
              ยังไม่เคย Publish — ไปที่หน้า <Link href="/prices" className="text-brand-600 underline">ปรับปรุงราคา</Link> แล้วกด Publish
            </>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pubs.map((p, i) => (
            <Link key={p.id} href={`/publications/${p.id}`} className="group">
              <Card className="overflow-hidden transition group-hover:shadow-md group-hover:ring-2 group-hover:ring-brand-200">
                <div className="relative aspect-[210/297] bg-slate-100">
                  {p.pageIds[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${p.pageIds[0]}`} alt="" className="size-full object-cover object-top" loading="lazy" />
                  ) : (
                    <div className="grid size-full place-items-center text-slate-300">
                      <FileImage className="size-10" />
                    </div>
                  )}
                  {i === 0 && page === 1 && !filtered && <span className="absolute top-3 left-3 rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-medium text-white shadow">ล่าสุด</span>}
                  <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white">{p.pageCount} หน้า</span>
                </div>
                <div className="p-4">
                  <div className="font-medium text-ink-900">#{p.id} · {fmtDate(p.publishedAt)}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    เปลี่ยน {p.changeCount} รายการ · โดย {p.publishedBy ?? "—"}
                  </div>
                  {p.note && <div className="mt-2 line-clamp-2 text-sm text-slate-600">{p.note}</div>}
                  <PubDownloads id={p.id} publishedAt={p.publishedAt} pageIds={p.pageIds} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-5 flex flex-wrap items-center justify-center gap-1.5" aria-label="เลือกหน้า">
          <PageLink href={href(page - 1)} disabled={page <= 1} label="หน้าก่อน">
            <ChevronLeft className="size-4" />
          </PageLink>
          {pageList(page, pages).map((p, i) =>
            p === null ? (
              <span key={`gap${i}`} className="px-1 text-slate-400">…</span>
            ) : (
              <PageLink key={p} href={href(p)} active={p === page} label={`หน้า ${p}`}>
                {p}
              </PageLink>
            ),
          )}
          <PageLink href={href(page + 1)} disabled={page >= pages} label="หน้าถัดไป">
            <ChevronRight className="size-4" />
          </PageLink>
        </nav>
      )}
    </>
  );
}

/** 1 … 4 5 6 … 20 */
function pageList(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out: (number | null)[] = [];
  [...keep].sort((a, b) => a - b).forEach((p, i, arr) => {
    if (i && p - arr[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

function PageLink({ href, active, disabled, label, children }: { href: string; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) {
  const cls = "grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-medium tabular-nums ring-1";
  if (disabled) return <span className={cn(cls, "text-slate-300 ring-slate-100")} aria-label={label}>{children}</span>;
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(cls, active ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")}
    >
      {children}
    </Link>
  );
}
