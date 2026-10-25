import { LoginForm } from "./forms";

export const metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <>
      <h2 className="mb-1 text-lg font-semibold text-ink-900">เข้าสู่ระบบ</h2>
      <p className="mb-5 text-sm text-slate-500">ป้องกันด้วยการยืนยันตัวตน 2 ขั้นตอน (2FA)</p>
      <LoginForm />
    </>
  );
}
