"use client";

import { useActionState } from "react";
import { Button, FormError, Input, Label } from "@/components/ui";
import { loginAction, setupAction, verifyAction, type FormState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" name="email" type="email" autoComplete="username" autoFocus required placeholder="you@example.com" />
      </div>
      <div>
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormError message={state?.error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}

export function CodeForm({ mode }: { mode: "verify" | "setup" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    mode === "verify" ? verifyAction : setupAction,
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="code">รหัส 6 หลักจากแอป Authenticator</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          required
          placeholder="••••••"
          className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
        />
      </div>
      <FormError message={state?.error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "กำลังตรวจสอบ…" : mode === "verify" ? "ยืนยัน" : "เปิดใช้งาน 2FA"}
      </Button>
    </form>
  );
}
