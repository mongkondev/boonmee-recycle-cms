import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { AccountForm, ShopForm } from "./forms";

export const metadata = { title: "ตั้งค่า" };

export default async function SettingsPage() {
  const [settings, user] = await Promise.all([getSettings(), requireUser()]);
  return (
    <>
      <PageHeader title="ตั้งค่า" />
      <div className="grid gap-6 lg:grid-cols-2">
        <ShopForm initial={settings} />
        <AccountForm username={user.username} displayName={user.displayName ?? ""} />
      </div>
    </>
  );
}
