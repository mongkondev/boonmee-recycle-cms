import { notFound } from "next/navigation";
import { getPublication } from "@/lib/queries";
import { PublicationView } from "./publication-view";

export const metadata = { title: "เมนูราคา A4" };

export default async function PublicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> }) {
  const id = Number((await params).id);
  const pub = Number.isInteger(id) ? await getPublication(id) : null;
  if (!pub) notFound();
  return <PublicationView pub={pub} fresh={(await searchParams).fresh === "1"} />;
}
