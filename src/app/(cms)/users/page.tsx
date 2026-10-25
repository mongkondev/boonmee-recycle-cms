import { PageHeader } from "@/components/ui";
import { requireSuper } from "@/lib/auth";
import { getUsersAndInvites } from "@/lib/queries";
import { UserManager } from "./user-manager";

export const metadata = { title: "ผู้ดูแลระบบ" };

export default async function UsersPage() {
  const me = await requireSuper();
  const data = await getUsersAndInvites();
  return (
    <>
      <PageHeader title="ผู้ดูแลระบบ" description="เชิญ admin ด้วยลิงก์ ผู้ได้รับเชิญจะตั้งรหัสผ่านและผูก Google Authenticator เอง" />
      <UserManager {...data} meId={me.id} mailEnabled={Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM)} />
    </>
  );
}
