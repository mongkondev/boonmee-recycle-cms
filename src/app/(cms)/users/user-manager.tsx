"use client";

import { Check, Copy, KeyRound, LoaderCircle, Mail, MessageCircle, RefreshCw, Send, ShieldCheck, ShieldOff, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button, Card, cn, FormError, Input, Label, Toggle } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import type { getUsersAndInvites } from "@/lib/queries";
import { fmtDate } from "@/lib/trend";
import { createInvite, deleteUser, resendInvite, resetUserTotp, revokeInvite, setUserActive } from "@/lib/user-actions";

type Data = Awaited<ReturnType<typeof getUsersAndInvites>>;
type Issued = { email: string; link: string; emailed: boolean };

export function UserManager({ users, invites, meId, mailEnabled }: Data & { meId: number; mailEnabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ email: "", displayName: "" });
  const [error, setError] = useState<string>();
  const [issued, setIssued] = useState<Issued | null>(null);

  const act = (fn: () => Promise<ActionResult<unknown>>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      const res = await fn();
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  };

  const onInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const res = await createInvite(form);
      if (!res.ok) return setError(res.error);
      setIssued({ email: form.email.trim().toLowerCase(), ...res.data! });
      setForm({ email: "", displayName: "" });
      router.refresh();
    });
  };

  const onResend = (id: number, email: string) =>
    start(async () => {
      const res = await resendInvite(id);
      if (res.ok) setIssued({ email, ...res.data! });
      else alert(res.error);
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-ink-900">
            <Send className="size-4 text-brand-500" /> เชิญ admin
          </h2>
          <p className="mb-4 text-xs text-slate-500">ลิงก์ใช้ได้ครั้งเดียว ภายใน 72 ชั่วโมง</p>
          <form onSubmit={onInvite} className="space-y-3">
            <div>
              <Label htmlFor="inv-email" required>อีเมล</Label>
              <Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" required />
            </div>
            <div>
              <Label htmlFor="inv-name">ชื่อที่แสดง</Label>
              <Input id="inv-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="ไม่บังคับ" />
            </div>
            <FormError message={error} />
            <Button className="w-full" disabled={pending || !form.email}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} สร้างลิงก์เชิญ
            </Button>
          </form>
        </Card>
        {issued && <IssuedLink issued={issued} mailEnabled={mailEnabled} onClose={() => setIssued(null)} />}
      </div>

      <div className="space-y-6">
        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 font-semibold text-ink-900">ผู้ใช้ ({users.length})</div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5">ผู้ใช้</th>
                <th className="px-3 py-2.5">สิทธิ์</th>
                <th className="px-3 py-2.5">2FA</th>
                <th className="px-3 py-2.5">สถานะ</th>
                <th className="px-4 py-2.5 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const self = u.id === meId;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {u.displayName || u.email} {self && <span className="text-xs font-normal text-slate-400">(คุณ)</span>}
                      </div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", u.role === "super" ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600")}>
                        {u.role === "super" ? "Super admin" : "Admin"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {u.totpEnabled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-brand-600"><ShieldCheck className="size-4" /> เปิดแล้ว</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600"><ShieldOff className="size-4" /> รอตั้งค่า</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {self ? <Badge active /> : (
                        <div className="flex items-center gap-2">
                          <Toggle checked={u.isActive} disabled={pending} onChange={(v) => act(() => setUserActive(u.id, v))} label="เปิดใช้งาน" />
                          <span className="text-xs text-slate-500">{u.isActive ? "ใช้งาน" : "ระงับ"}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!self && (
                        <>
                          <button
                            title="รีเซ็ต Google Authenticator"
                            onClick={() => act(() => resetUserTotp(u.id), `รีเซ็ต 2FA ของ ${u.email}? ผู้ใช้ต้องสแกน QR ใหม่เมื่อ login ครั้งถัดไป`)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                          >
                            <KeyRound className="size-4" />
                          </button>
                          <button
                            title="ลบผู้ใช้"
                            onClick={() => act(() => deleteUser(u.id), `ลบผู้ใช้ ${u.email}?`)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-accent-50 hover:text-accent-500"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 font-semibold text-ink-900">คำเชิญที่รอตอบรับ ({invites.length})</div>
          {invites.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">ไม่มีคำเชิญค้าง</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800">{i.displayName || i.email}</div>
                    <div className="text-xs text-slate-400">
                      {i.email} · {i.expired ? <span className="text-accent-500">หมดอายุแล้ว</span> : `หมดอายุ ${fmtDate(i.expiresAt)}`}
                      {i.invitedBy && ` · เชิญโดย ${i.invitedBy}`}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => onResend(i.id, i.email)}>
                    <RefreshCw className="size-3.5" /> สร้างลิงก์ใหม่
                  </Button>
                  <button title="ยกเลิกคำเชิญ" onClick={() => act(() => revokeInvite(i.id), `ยกเลิกคำเชิญ ${i.email}?`)} className="rounded-lg p-2 text-slate-400 hover:bg-accent-50 hover:text-accent-500">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function IssuedLink({ issued, mailEnabled, onClose }: { issued: Issued; mailEnabled: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `คำเชิญเข้าใช้งานระบบ บุญมี รีไซเคิล CMS\nตั้งรหัสผ่านและผูก Google Authenticator ได้ที่ลิงก์นี้ (ใช้ได้ 72 ชม.)\n${issued.link}`;
  return (
    <Card className="border-brand-200 bg-brand-50/60 p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-brand-700">
          {issued.emailed ? `ส่งอีเมลเชิญไปที่ ${issued.email} แล้ว` : `ลิงก์เชิญสำหรับ ${issued.email}`}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ปิด"><X className="size-4" /></button>
      </div>
      {!issued.emailed && (
        <p className="mb-2 text-xs text-slate-500">
          {mailEnabled ? "ส่งอีเมลไม่สำเร็จ — " : ""}คัดลอกลิงก์แล้วส่งให้ผู้รับทาง LINE หรืออีเมล ลิงก์จะแสดงครั้งเดียว
        </p>
      )}
      <div className="mb-3 rounded-lg bg-white p-2 font-mono text-xs break-all text-slate-700 ring-1 ring-slate-200 select-all">{issued.link}</div>
      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(issued.link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3.5 text-brand-600" /> : <Copy className="size-3.5" />} {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </Button>
        <a
          href={`https://line.me/R/share?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#06c755] text-sm font-medium text-white hover:brightness-95"
        >
          <MessageCircle className="size-3.5" /> LINE
        </a>
        <a
          href={`mailto:${issued.email}?subject=${encodeURIComponent("คำเชิญเข้าใช้งานระบบ บุญมี รีไซเคิล CMS")}&body=${encodeURIComponent(text)}`}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Mail className="size-3.5" /> อีเมล
        </a>
      </div>
    </Card>
  );
}
