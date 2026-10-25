import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: { default: "บุญมี รีไซเคิล CMS", template: "%s · บุญมี รีไซเคิล CMS" },
  description: "ระบบจัดการราคารับซื้อของเก่า ร้านบุญมี รีไซเคิล",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
