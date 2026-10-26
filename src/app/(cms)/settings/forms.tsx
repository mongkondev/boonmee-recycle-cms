"use client";

import { Copy, ImageIcon, LoaderCircle, Save, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PasswordFields } from "@/components/password-fields";
import { Button, Card, FormError, Input, Label, Toggle } from "@/components/ui";
import { changePassword, saveSettings, uploadImage } from "@/lib/actions";
import { DAY_NAMES, type DayHours, hoursSummary, parseHours } from "@/lib/hours";
import { shrinkImage } from "@/lib/shrink-image";
import type { ShopSettings } from "@/lib/types";

type Field = { key: keyof ShopSettings; label: string; hint?: string; placeholder?: string; type?: string };

const SECTIONS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: "ข้อมูลร้าน",
    fields: [
      { key: "shop_name", label: "ชื่อร้าน" },
      { key: "tagline", label: "ข้อความรับซื้อ (ใต้ชื่อร้าน)" },
      { key: "address", label: "ที่อยู่ร้าน", hint: "พิมพ์บนบิล / ใบขาย" },
    ],
  },
  {
    title: "ข้อมูลติดต่อ",
    fields: [
      { key: "phones", label: "เบอร์โทร", hint: "คั่นหลายเบอร์ด้วยจุลภาค (,)", type: "tel" },
      { key: "line_url", label: "ลิงก์ LINE", hint: "ใช้สร้าง QR เมื่อไม่ได้อัพโหลดรูป QR เช่น https://line.me/R/ti/p/@xxxx" },
      { key: "facebook", label: "Facebook" },
      { key: "website", label: "เว็บไซต์" },
    ],
  },
  {
    title: "บัญชีร้าน (รับโอน)",
    note: "พิมพ์บนใบขายเมื่อรับเงินแบบโอน",
    fields: [
      { key: "bank_name", label: "ธนาคาร", placeholder: "เช่น กสิกรไทย" },
      { key: "bank_account", label: "เลขที่บัญชี" },
      { key: "bank_account_name", label: "ชื่อบัญชี" },
    ],
  },
];

export function ShopForm({ initial }: { initial: ShopSettings }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [hours, setHours] = useState<DayHours[]>(() => parseHours(initial.hours));
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const setDay = (d: number, p: Partial<DayHours>) => setHours((h) => h.map((x, i) => (i === d ? { ...x, ...p } : x)));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(undefined);
        start(async () => {
          const res = await saveSettings({ ...v, hours: JSON.stringify(hours) });
          setMsg(res.ok ? "บันทึกแล้ว" : res.error);
          router.refresh();
        });
      }}
    >
      <Card className="p-6">
        <h2 className="mb-4 font-semibold text-ink-900">โลโก้ และ QR LINE</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageSetting label="โลโก้ร้าน" hint="แสดงบนบิล / ใบขาย · แนะนำ PNG พื้นใส" value={v.logo_image} onChange={(id) => setV({ ...v, logo_image: id })} max={600} />
          <ImageSetting
            label="รูป QR LINE"
            hint="ใช้บนเมนูราคาแทน QR ที่สร้างจากลิงก์"
            value={v.line_qr_image}
            onChange={(id) => setV({ ...v, line_qr_image: id })}
            max={800}
          />
        </div>
      </Card>

      {SECTIONS.map((sec) => (
        <Card key={sec.title} className="p-6">
          <h2 className="font-semibold text-ink-900">{sec.title}</h2>
          {sec.note && <p className="text-sm text-slate-500">{sec.note}</p>}
          <div className="mt-4 space-y-4">
            {sec.fields.map((f) => (
              <div key={f.key}>
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input id={f.key} type={f.type} placeholder={f.placeholder} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
                {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-ink-900">เวลาเปิด-ปิด</h2>
            <p className="text-sm text-slate-500">บนเมนูราคา: {hoursSummary(hours)}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setHours((h) => h.map((d) => (d.open ? { ...d, from: h[1].from, to: h[1].to } : d)))}
          >
            <Copy className="size-3.5" /> ใช้เวลาวันจันทร์กับทุกวันที่เปิด
          </Button>
        </div>
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="w-20 text-sm font-medium text-slate-700">{DAY_NAMES[d]}</span>
              <Toggle checked={hours[d].open} onChange={(open) => setDay(d, { open })} label={`เปิดวัน${DAY_NAMES[d]}`} />
              {hours[d].open ? (
                <div className="flex items-center gap-2">
                  <Input type="time" value={hours[d].from} onChange={(e) => setDay(d, { from: e.target.value })} className="w-32" aria-label={`เปิด ${DAY_NAMES[d]}`} />
                  <span className="text-slate-400">–</span>
                  <Input type="time" value={hours[d].to} onChange={(e) => setDay(d, { to: e.target.value })} className="w-32" aria-label={`ปิด ${DAY_NAMES[d]}`} />
                </div>
              ) : (
                <span className="text-sm text-slate-400">ปิดร้าน</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-xl bg-white/90 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <Button disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} บันทึกการตั้งค่าร้าน
        </Button>
        {msg && <span className="text-sm text-brand-600">{msg}</span>}
      </div>
    </form>
  );
}

/** Upload / replace / remove one image setting (stored as an image id). */
function ImageSetting({ label, hint, value, onChange, max }: { label: string; hint: string; value: string; onChange: (id: string) => void; max: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/images/${value}`} alt={label} className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-8 text-slate-300" />
          )}
        </div>
        <div className="space-y-2">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {value ? "เปลี่ยนรูป" : "อัพโหลด"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="text-accent-600" onClick={() => onChange("")}>
              <Trash2 className="size-3.5" /> เอาออก
            </Button>
          )}
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          setError(undefined);
          try {
            const fd = new FormData();
            fd.set("file", await shrinkImage(f, max));
            const res = await uploadImage(fd);
            if (!res.ok) throw new Error(res.error);
            onChange(res.data!.id);
          } catch (err) {
            setError((err as Error).message || "อัพโหลดไม่สำเร็จ");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <FormError message={error} />
    </div>
  );
}

export function AccountForm({ email, displayName }: { email: string; displayName: string }) {
  const router = useRouter();
  const [v, setV] = useState({ displayName, current: "", next: "", confirm: "" });
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Card className="h-fit p-6">
      <h2 className="mb-1 font-semibold text-ink-900">บัญชีผู้ใช้</h2>
      <p className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
        <ShieldCheck className="size-4 text-brand-500" /> {email} · เปิดใช้งาน 2FA แล้ว
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(undefined);
          setOk(false);
          start(async () => {
            if (v.next && v.next !== v.confirm) return setError("ยืนยันรหัสผ่านไม่ตรงกัน");
            const res = await changePassword(v);
            if (!res.ok) return setError(res.error);
            setOk(true);
            setV((s) => ({ ...s, current: "", next: "", confirm: "" }));
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
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-3 text-xs text-slate-500">เปลี่ยนรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)</p>
          <PasswordFields
            label="รหัสผ่านใหม่"
            password={v.next}
            confirm={v.confirm}
            onPassword={(next) => setV({ ...v, next })}
            onConfirm={(confirm) => setV({ ...v, confirm })}
          />
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
