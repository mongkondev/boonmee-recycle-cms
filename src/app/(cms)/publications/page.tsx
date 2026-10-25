import { FileImage, Megaphone } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { getPublications } from "@/lib/queries";
import { PubDownloads } from "./pub-downloads";
import { fmtDate } from "@/lib/trend";

export const metadata = { title: "ประกาศราคา" };

export default async function PublicationsPage() {
  const pubs = await getPublications();
  return (
    <>
      <PageHeader title="ประวัติการ Publish" description="ทุกครั้งที่ Publish ระบบสร้างประวัติและเก็บเมนูราคา A4 ไว้ ดาวน์โหลดไฟล์รอบก่อนๆ ส่งลูกค้าได้ทุกเมื่อ" />
      {pubs.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Megaphone className="mx-auto mb-3 size-8" />
          ยังไม่เคย Publish — ไปที่หน้า <Link href="/prices" className="text-brand-600 underline">ปรับปรุงราคา</Link> แล้วกด Publish
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
                  {i === 0 && <span className="absolute top-3 left-3 rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-medium text-white shadow">ล่าสุด</span>}
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
    </>
  );
}
