import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const img = await db.query.images.findFirst({ where: eq(schema.images.id, id) });
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      // image rows are immutable: a replaced image gets a new id
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
