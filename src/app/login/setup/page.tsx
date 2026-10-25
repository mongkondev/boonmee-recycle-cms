import { getSetupQr } from "../actions";
import { Steps } from "@/components/steps";
import { CodeForm } from "../forms";

export const metadata = { title: "ตั้งค่า 2FA" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const [{ qr, secret }, { step }] = await Promise.all([getSetupQr(), searchParams]);
  return (
    <>
      {step === "2" && <Steps current={2} />}
      <h2 className="font-semibold text-ink-900">ตั้งค่าการยืนยัน 2 ขั้นตอน</h2>
      <ol className="mt-2 mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>ติดตั้ง Google Authenticator / Microsoft Authenticator</li>
        <li>สแกน QR ด้านล่าง</li>
        <li>กรอกรหัส 6 หลักที่แอปแสดง</li>
      </ol>
      <div className="mb-4 flex flex-col items-center rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR สำหรับ Authenticator" className="size-44 rounded-lg bg-white p-1" />
        <p className="mt-3 text-xs text-slate-500">หรือกรอกรหัสนี้ด้วยตนเอง</p>
        <code className="mt-1 rounded bg-white px-2 py-1 font-mono text-xs break-all text-ink-900 select-all">{secret}</code>
      </div>
      <CodeForm mode="setup" />
    </>
  );
}
