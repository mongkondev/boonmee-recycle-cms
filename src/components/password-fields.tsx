"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";
import { PASSWORD_RULES } from "@/lib/password-policy";
import { cn, Input, Label } from "./ui";

/** Password + confirm with a live rule checklist: each rule turns green once satisfied. */
export function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  label = "รหัสผ่าน",
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  const matched = confirm.length > 0 && confirm === password;
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="new-password" required>{label}</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            className="pr-10"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.id} className={cn("flex items-center gap-1.5 transition-colors", ok ? "font-medium text-brand-600" : "text-slate-400")}>
                <span className={cn("grid size-4 place-items-center rounded-full", ok ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-400")}>
                  {ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
                </span>
                {r.label}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <Label htmlFor="confirm-password" required>ยืนยันรหัสผ่าน</Label>
        <Input
          id="confirm-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          className={cn(confirm && (matched ? "border-brand-500 ring-3 ring-brand-500/15" : "border-accent-500"))}
        />
        {confirm && (
          <p className={cn("mt-1 flex items-center gap-1 text-xs", matched ? "text-brand-600" : "text-accent-500")}>
            {matched ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {matched ? "รหัสผ่านตรงกัน" : "รหัสผ่านไม่ตรงกัน"}
          </p>
        )}
      </div>
    </div>
  );
}
