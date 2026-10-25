import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <Shell user={{ name: user.displayName || user.username }}>{children}</Shell>;
}
