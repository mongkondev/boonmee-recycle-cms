import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { AccountForm, ShopForm } from "./forms";

export const metadata = { title: "ตั้งค่า" };

export default async function SettingsPage() {
  const [settings, user] = await Promise.all([getSettings(), requireUser()]);
  return (
    <>
      <PageHeader title="ตั้งค่า" description="ข้อมูลร้าน ติดต่อ โลโก้ QR LINE บัญชีร้าน และเวลาเปิด-ปิด ใช้บนเมนูราคา บิล และใบขาย" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <ShopForm initial={settings} />
        <AccountForm email={user.email ?? user.username ?? ""} displayName={user.displayName ?? ""} />
      </div>
    </>
  );
}
