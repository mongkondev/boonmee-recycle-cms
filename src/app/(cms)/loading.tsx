import { LoaderCircle } from "lucide-react";

/** Shown inside the CMS shell while the next page loads (every page reads the database). */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center gap-3">
        <LoaderCircle className="size-6 animate-spin text-brand-500" />
        <span className="text-sm text-slate-500">กำลังโหลด…</span>
      </div>
      <div className="mb-4 h-8 w-64 rounded-lg bg-slate-200/70" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-white ring-1 ring-slate-200" />
        ))}
      </div>
      <div className="mt-5 h-72 rounded-xl bg-white ring-1 ring-slate-200" />
    </div>
  );
}
