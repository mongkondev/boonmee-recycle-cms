import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CodeForm } from "../forms";

export const metadata = { title: "ยืนยัน 2FA" };

export default function VerifyPage() {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-600">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold text-ink-900">ยืนยันตัวตนขั้นที่ 2</h2>
          <p className="text-sm text-slate-500">เปิดแอป Authenticator แล้วกรอกรหัส</p>
        </div>
      </div>
      <CodeForm mode="verify" />
      <Link href="/login" className="mt-4 block text-center text-sm text-slate-500 hover:text-brand-600">
        ← กลับไปหน้าเข้าสู่ระบบ
      </Link>
    </>
  );
}
