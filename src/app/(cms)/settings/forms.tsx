"use client";

import { Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, FormError, Input, Label } from "@/components/ui";
import { changePassword, saveSettings } from "@/lib/actions";
import type { ShopSettings } from "@/lib/types";

const FIELDS: { key: keyof ShopSettings; label: string; hint?: string }[] = [
  { key: "shop_name", label: "ชื่อร้าน" },
  { key: "phones", label: "เบอร์โทร", hint: "คั่นหลายเบอร์ด้วยจุลภาค (,)" },
  { key: "tagline", label: "ข้อความรับซื้อ (ใต้ชื่อร้าน)" },
  { key: "open_hours", label: "เวลาเปิดร้าน" },
  { key: "line_url", label: "ลิงก์ LINE (ใช้สร้าง QR บนเมนูราคา)", hint: "เช่น https://line.me/R/ti/p/@xxxx" },
  { key: "website", label: "เว็บไซต์" },
];

export function ShopForm({ initial }: { initial: ShopSettings }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card className="p-6">
      <h2 className="mb-1 font-semibold text-ink-900">ข้อมูลร้าน</h2>
      <p className="mb-5 text-sm text-slate-500">แสดงบนหัว/ท้ายเมนูราคา</p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveSettings(v);
            setMsg(res.ok ? "บันทึกแล้ว" : res.error);
            router.refresh();
          });
        }}
      >
        {FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input id={f.key} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
          </div>
        ))}
        <div className="flex items-center gap-3">
          <Button disabled={pending}><Save className="size-4" /> บันทึก</Button>
          {msg && <span className="text-sm text-brand-600">{msg}</span>}
        </div>
      </form>
    </Card>
  );
}

export function AccountForm({ username, displayName }: { username: string; displayName: string }) {
  const router = useRouter();
  const [v, setV] = useState({ displayName, current: "", next: "" });
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Card className="h-fit p-6">
      <h2 className="mb-1 font-semibold text-ink-900">บัญชีผู้ใช้</h2>
      <p className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
        <ShieldCheck className="size-4 text-brand-500" /> {username} · เปิดใช้งาน 2FA แล้ว
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(undefined);
          setOk(false);
          start(async () => {
            const res = await changePassword(v);
            if (!res.ok) return setError(res.error);
            setOk(true);
            setV((s) => ({ ...s, current: "", next: "" }));
            router.refresh();
          });
        }}
      >
        <div>
          <Label htmlFor="displayName">ชื่อที่แสดง</Label>
          <Input id="displayName" value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="current">รหัสผ่านปัจจุบัน</Label>
          <Input id="current" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="next">รหัสผ่านใหม่</Label>
          <Input id="next" type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} placeholder="เว้นว่างถ้าไม่เปลี่ยน (อย่างน้อย 8 ตัว)" />
        </div>
        <FormError message={error} />
        <div className="flex items-center gap-3">
          <Button disabled={pending}><Save className="size-4" /> บันทึก</Button>
          {ok && <span className="text-sm text-brand-600">บันทึกแล้ว</span>}
        </div>
      </form>
    </Card>
  );
}
