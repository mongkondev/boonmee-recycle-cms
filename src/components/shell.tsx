"use client";

import {
  FileImage,
  FolderTree,
  History,
  LogOut,
  Megaphone,
  Menu,
  HandCoins,
  LayoutDashboard,
  Package,
  ReceiptText,
  Boxes,
  ChartColumn,
  Ruler,
  Settings,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/login/actions";
import { cn } from "./ui";

const NAV: { group: string; items: { href: string; label: string; icon: typeof Settings; superOnly?: boolean; exact?: boolean }[] }[] = [
  {
    group: "ภาพรวม",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    group: "ซื้อ-ขาย",
    items: [
      { href: "/bills", label: "รับซื้อเข้า / บิลเงินสด", icon: ReceiptText },
      { href: "/sales", label: "ขายออก / ใบขาย", icon: HandCoins },
      { href: "/lots", label: "LOT คงเหลือ", icon: Boxes },
      { href: "/reports", label: "รายงาน", icon: ChartColumn },
    ],
  },
  {
    group: "ราคา",
    items: [
      { href: "/prices", label: "ปรับปรุงราคา", icon: TrendingUp },
      { href: "/publications", label: "ประวัติ Publish (A4)", icon: Megaphone },
      { href: "/history", label: "ประวัติราคา", icon: History },
      { href: "/export", label: "เมนูราคา", icon: FileImage },
    ],
  },
  {
    group: "ข้อมูลหลัก",
    items: [
      { href: "/products", label: "สินค้ารับซื้อ", icon: Package },
      { href: "/categories", label: "หมวดหมู่", icon: FolderTree },
      { href: "/units", label: "หน่วย", icon: Ruler },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { href: "/users", label: "ผู้ดูแลระบบ", icon: Users, superOnly: true },
      { href: "/settings", label: "ตั้งค่า", icon: Settings },
    ],
  },
];

const ALL = NAV.flatMap((g) => g.items);

export function Shell({ user, children }: { user: { name: string; role: "super" | "admin" }; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (i: { href: string; exact?: boolean }) => (i.exact ? pathname === i.href : pathname.startsWith(i.href));
  const current = ALL.find(isActive);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink-900 text-brand-50 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="size-9 rounded-xl" />
          <div className="leading-tight">
            <div className="font-semibold text-white">บุญมี รีไซเคิล</div>
            <div className="text-xs text-brand-200/70">Price CMS</div>
          </div>
          <button className="ml-auto rounded p-1 text-brand-100 lg:hidden" onClick={() => setOpen(false)} aria-label="ปิดเมนู">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="mb-2 px-3 text-xs font-medium tracking-wider text-brand-200/50 uppercase">{g.group}</div>
              <ul className="space-y-1">
                {g.items.filter((i) => !i.superOnly || user.role === "super").map((item) => {
                  const { href, label, icon: Icon } = item;
                  const active = isActive(item);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-brand-500 font-medium text-white shadow-lg shadow-brand-900/40"
                            : "text-brand-100/80 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon className="size-4.5" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="m-3 rounded-xl bg-white/5 p-3 text-xs text-brand-100/70">
          เคล็ดลับ: หน้า <b className="text-white">ปรับปรุงราคา</b> กด <kbd className="rounded bg-white/10 px-1">Enter</kbd> บันทึกร่าง แล้วกด <b className="text-white">Publish</b> เพื่อประกาศราคาและสร้างเมนู A4
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* navbar */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
        <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="เปิดเมนู">
          <Menu className="size-5" />
        </button>
        <div className="text-sm text-slate-500">
          <span className="hidden sm:inline">CMS / </span>
          <span className="font-medium text-ink-900">{current?.label ?? "หน้าหลัก"}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 md:inline">
            {new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pr-1 pl-3">
            <span className="text-sm font-medium text-slate-700">{user.name}</span>
            {user.role === "super" && <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-semibold text-white">SUPER</span>}
            <span className="grid size-7 place-items-center rounded-full bg-brand-500 text-xs font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <form action={logoutAction}>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-accent-500" title="ออกจากระบบ">
              <LogOut className="size-4.5" />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
