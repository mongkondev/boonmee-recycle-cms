import Link from "next/link";
import { findOpenInvite } from "@/lib/invites";
import AuthLayout from "../../login/layout";
import { Steps } from "@/components/steps";
import { InviteForm } from "./invite-form";

export const metadata = { title: "ตั้งรหัสผ่าน" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findOpenInvite(token);
  return (
    <AuthLayout>
      {invite ? (
        <>
          <Steps current={1} />
          <h2 className="font-semibold text-ink-900">ตั้งรหัสผ่าน</h2>
          <p className="mb-5 text-sm text-slate-500">
            บัญชี <b className="text-ink-900">{invite.email}</b>
          </p>
          <InviteForm token={token} />
        </>
      ) : (
        <div className="text-center">
          <h2 className="font-semibold text-ink-900">ลิงก์ไม่ถูกต้อง</h2>
          <p className="mt-2 text-sm text-slate-500">ลิงก์คำเชิญหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแลระบบ</p>
          <Link href="/login" className="mt-4 inline-block text-sm text-brand-600 hover:underline">ไปหน้าเข้าสู่ระบบ</Link>
        </div>
      )}
    </AuthLayout>
  );
}
