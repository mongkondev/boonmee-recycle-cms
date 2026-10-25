"use server";

import bcrypt from "bcryptjs";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "./auth";
import { buildMenu } from "./menu";
import { passwordProblems } from "./password-policy";
import { getProducts, getSettings } from "./queries";
import type { ShopSettings } from "./types";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

function revalidateAll() {
  for (const p of ["/prices", "/products", "/categories", "/units", "/export", "/history", "/publications"]) revalidatePath(p);
}

function isFkViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23503" || err?.cause?.code === "23503";
}

/* ---------------- prices: draft → publish ---------------- */

const priceSchema = z.number().finite().min(0, "ราคาต้องไม่ติดลบ").max(9_999_999_999);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stage a new price. A draft equal to the live price clears the draft. */
export async function saveDraft(productId: number, newPrice: number): Promise<ActionResult<{ draftPrice: number | null }>> {
  await requireUser();
  const parsed = priceSchema.safeParse(newPrice);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const price = round2(parsed.data);
  const [row] = await db
    .update(schema.products)
    .set({ draftPrice: sql`case when ${schema.products.price} = ${price} then null else ${price}::numeric end` })
    .where(eq(schema.products.id, productId))
    .returning({ draftPrice: schema.products.draftPrice });
  if (!row) return fail("ไม่พบสินค้า");
  // no revalidatePath: every CMS page is dynamic, and skipping it keeps Enter-to-save snappy
  return { ok: true, data: { draftPrice: row.draftPrice } };
}

export async function discardDrafts(): Promise<ActionResult> {
  await requireUser();
  await db.update(schema.products).set({ draftPrice: null }).where(isNotNull(schema.products.draftPrice));
  revalidateAll();
  return { ok: true };
}

/**
 * Apply every draft price, log history, and freeze the resulting menu as a publication.
 * The client then renders the A4 pages from the snapshot and uploads them (savePublicationPage).
 */
export async function publish(note: string): Promise<ActionResult<{ id: number }>> {
  const user = await requireUser();
  const id = await db.transaction(async (tx) => {
    const [pub] = await tx
      .insert(schema.publications)
      .values({ note: note.trim().slice(0, 300) || null, snapshot: {}, publishedBy: user.id })
      .returning({ id: schema.publications.id });
    const drafts = await tx
      .select({ id: schema.products.id, price: schema.products.price, draft: schema.products.draftPrice })
      .from(schema.products)
      .where(isNotNull(schema.products.draftPrice))
      .for("update");
    const now = new Date();
    for (const d of drafts) {
      await tx
        .update(schema.products)
        .set({ price: d.draft!, draftPrice: null, updatedAt: now })
        .where(eq(schema.products.id, d.id));
      await tx.insert(schema.priceHistory).values({
        productId: d.id,
        oldPrice: d.price,
        newPrice: d.draft!,
        changedBy: user.id,
        publicationId: pub.id,
        changedAt: now,
      });
    }
    const snapshot = buildMenu(await getProducts(tx), await getSettings());
    await tx
      .update(schema.publications)
      .set({ snapshot, changeCount: drafts.length })
      .where(eq(schema.publications.id, pub.id));
    return pub.id;
  });
  revalidateAll();
  revalidatePath("/publications");
  return { ok: true, data: { id } };
}

/** Store one rendered A4 page image (replaces an existing page with the same number). */
export async function savePublicationPage(publicationId: number, pageNo: number, form: FormData): Promise<ActionResult> {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || file.type !== "image/jpeg") return fail("ไฟล์ไม่ถูกต้อง");
  if (file.size > 8 * 1024 * 1024) return fail("ไฟล์ใหญ่เกินไป");
  await db.transaction(async (tx) => {
    const old = await tx
      .select({ imageId: schema.publicationPages.imageId })
      .from(schema.publicationPages)
      .where(and(eq(schema.publicationPages.publicationId, publicationId), eq(schema.publicationPages.pageNo, pageNo)));
    // deleting the image cascades to its publication_pages row
    for (const o of old) await tx.delete(schema.images).where(eq(schema.images.id, o.imageId));
    const [img] = await tx
      .insert(schema.images)
      .values({ mime: file.type, data: Buffer.from(await file.arrayBuffer()) })
      .returning({ id: schema.images.id });
    await tx.insert(schema.publicationPages).values({ publicationId, pageNo, imageId: img.id });
  });
  revalidatePath("/publications");
  return { ok: true };
}

/** Drop stored pages beyond `pageCount` (when a re-render produced fewer pages). */
export async function trimPublicationPages(publicationId: number, pageCount: number): Promise<ActionResult> {
  await requireUser();
  const extra = await db
    .select({ imageId: schema.publicationPages.imageId })
    .from(schema.publicationPages)
    .where(and(eq(schema.publicationPages.publicationId, publicationId), gt(schema.publicationPages.pageNo, pageCount)));
  for (const e of extra) await db.delete(schema.images).where(eq(schema.images.id, e.imageId));
  return { ok: true };
}

/* ---------------- categories ---------------- */

const nameSchema = z.string().trim().min(1, "กรุณากรอกชื่อ").max(120);

export async function saveMainCategory(input: { id?: number; name: string; isActive?: boolean }): Promise<ActionResult> {
  await requireUser();
  const name = nameSchema.safeParse(input.name);
  if (!name.success) return fail(name.error.issues[0].message);
  if (input.id) {
    await db
      .update(schema.mainCategories)
      .set({ name: name.data, ...(input.isActive !== undefined && { isActive: input.isActive }) })
      .where(eq(schema.mainCategories.id, input.id));
  } else {
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(sort_order), -1)::int` }).from(schema.mainCategories);
    await db.insert(schema.mainCategories).values({ name: name.data, sortOrder: max + 1 });
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteMainCategory(id: number): Promise<ActionResult> {
  await requireUser();
  try {
    await db.delete(schema.mainCategories).where(eq(schema.mainCategories.id, id));
  } catch (e) {
    if (isFkViolation(e)) return fail("ลบไม่ได้: ยังมีสินค้าอยู่ในหมวดนี้ กรุณาย้ายหรือลบสินค้าก่อน");
    throw e;
  }
  revalidateAll();
  return { ok: true };
}

export async function saveSubCategory(input: {
  id?: number;
  mainCategoryId: number;
  name: string;
  isActive?: boolean;
}): Promise<ActionResult> {
  await requireUser();
  const name = nameSchema.safeParse(input.name);
  if (!name.success) return fail(name.error.issues[0].message);
  if (input.id) {
    await db
      .update(schema.subCategories)
      .set({
        name: name.data,
        mainCategoryId: input.mainCategoryId,
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      })
      .where(eq(schema.subCategories.id, input.id));
  } else {
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(sort_order), -1)::int` })
      .from(schema.subCategories)
      .where(eq(schema.subCategories.mainCategoryId, input.mainCategoryId));
    await db.insert(schema.subCategories).values({ mainCategoryId: input.mainCategoryId, name: name.data, sortOrder: max + 1 });
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteSubCategory(id: number): Promise<ActionResult> {
  await requireUser();
  try {
    await db.delete(schema.subCategories).where(eq(schema.subCategories.id, id));
  } catch (e) {
    if (isFkViolation(e)) return fail("ลบไม่ได้: ยังมีสินค้าอยู่ในหมวดนี้");
    throw e;
  }
  revalidateAll();
  return { ok: true };
}

/** Persist a new order. `table` decides which category level is reordered. */
export async function reorder(table: "main" | "sub" | "product" | "unit", ids: number[]): Promise<ActionResult> {
  await requireUser();
  const t = {
    main: schema.mainCategories,
    sub: schema.subCategories,
    product: schema.products,
    unit: schema.units,
  }[table];
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(t).set({ sortOrder: i }).where(eq(t.id, id));
  });
  revalidateAll();
  return { ok: true };
}

/* ---------------- units ---------------- */

export async function saveUnit(input: { id?: number; name: string }): Promise<ActionResult> {
  await requireUser();
  const name = nameSchema.safeParse(input.name);
  if (!name.success) return fail(name.error.issues[0].message);
  const dup = await db.query.units.findFirst({ where: eq(schema.units.name, name.data) });
  if (dup && dup.id !== input.id) return fail("มีหน่วยนี้อยู่แล้ว");
  if (input.id) {
    await db.update(schema.units).set({ name: name.data }).where(eq(schema.units.id, input.id));
  } else {
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(sort_order), -1)::int` }).from(schema.units);
    await db.insert(schema.units).values({ name: name.data, sortOrder: max + 1 });
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteUnit(id: number): Promise<ActionResult> {
  await requireUser();
  await db.delete(schema.units).where(eq(schema.units.id, id));
  revalidateAll();
  return { ok: true };
}

/* ---------------- products ---------------- */

const productSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ").max(200),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  price: z.number({ message: "กรุณากรอกราคา" }).finite().min(0, "ราคาต้องไม่ติดลบ").max(9_999_999_999),
  priceNote: z.string().trim().max(40).optional().transform((v) => v || null),
  unitId: z.number().int().nullable(),
  mainCategoryId: z.number({ message: "กรุณาเลือกหมวดหมู่หลัก" }).int(),
  subCategoryId: z.number().int().nullable(),
  isActive: z.boolean(),
  imageId: z.string().uuid().nullable(),
});

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireUser();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, ...data } = parsed.data;
  data.price = Math.round(data.price * 100) / 100;
  if (data.subCategoryId) {
    const sub = await db.query.subCategories.findFirst({ where: eq(schema.subCategories.id, data.subCategoryId) });
    if (sub?.mainCategoryId !== data.mainCategoryId) return fail("หมวดย่อยไม่อยู่ในหมวดหลักที่เลือก");
  }

  const savedId = await db.transaction(async (tx) => {
    if (id) {
      const [current] = await tx.select().from(schema.products).where(eq(schema.products.id, id)).for("update");
      if (!current) throw new Error("not found");
      // price changes on existing products go through the draft → publish flow
      const { price, ...rest } = data;
      await tx
        .update(schema.products)
        .set({ ...rest, draftPrice: price === current.price ? null : price, updatedAt: new Date() })
        .where(eq(schema.products.id, id));
      // drop the previous image once it is no longer referenced
      if (current.imageId && current.imageId !== data.imageId) {
        await tx.delete(schema.images).where(eq(schema.images.id, current.imageId));
      }
      return id;
    }
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(sort_order), -1)::int` })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.mainCategoryId, data.mainCategoryId),
          data.subCategoryId ? eq(schema.products.subCategoryId, data.subCategoryId) : isNull(schema.products.subCategoryId),
        ),
      );
    const [row] = await tx.insert(schema.products).values({ ...data, sortOrder: max + 1 }).returning({ id: schema.products.id });
    await tx.insert(schema.priceHistory).values({ productId: row.id, oldPrice: null, newPrice: data.price, changedBy: user.id });
    return row.id;
  });
  revalidateAll();
  return { ok: true, data: { id: savedId } };
}

export async function setProductActive(id: number, isActive: boolean): Promise<ActionResult> {
  await requireUser();
  await db.update(schema.products).set({ isActive }).where(eq(schema.products.id, id));
  revalidateAll();
  return { ok: true };
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  await requireUser();
  const [row] = await db.delete(schema.products).where(eq(schema.products.id, id)).returning();
  if (row?.imageId) await db.delete(schema.images).where(eq(schema.images.id, row.imageId));
  revalidateAll();
  return { ok: true };
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadImage(form: FormData): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("ไม่พบไฟล์");
  if (!IMAGE_TYPES.includes(file.type)) return fail("รองรับเฉพาะไฟล์ JPG, PNG, WEBP");
  if (file.size > MAX_IMAGE_BYTES) return fail("ไฟล์ใหญ่เกิน 2MB");
  const [row] = await db
    .insert(schema.images)
    .values({ mime: file.type, data: Buffer.from(await file.arrayBuffer()) })
    .returning({ id: schema.images.id });
  return { ok: true, data: { id: row.id } };
}

/* ---------------- settings & account ---------------- */

export async function saveSettings(input: ShopSettings): Promise<ActionResult> {
  await requireUser();
  const allowed: (keyof ShopSettings)[] = ["shop_name", "phones", "tagline", "open_hours", "line_url", "website"];
  await db.transaction(async (tx) => {
    for (const key of allowed) {
      const value = String(input[key] ?? "").trim().slice(0, 300);
      await tx.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
    }
  });
  revalidatePath("/settings");
  revalidatePath("/export");
  return { ok: true };
}

export async function changePassword(input: { current: string; next: string; displayName: string }): Promise<ActionResult> {
  const user = await requireUser();
  const displayName = input.displayName.trim().slice(0, 60) || null;
  if (input.next) {
    if (!(await bcrypt.compare(input.current, user.passwordHash))) return fail("รหัสผ่านปัจจุบันไม่ถูกต้อง");
    const problems = passwordProblems(input.next);
    if (problems.length) return fail(`รหัสผ่านใหม่ยังไม่ผ่านเงื่อนไข: ${problems.join(", ")}`);
    await db
      .update(schema.users)
      .set({ passwordHash: await bcrypt.hash(input.next, 12), displayName })
      .where(eq(schema.users.id, user.id));
  } else {
    await db.update(schema.users).set({ displayName }).where(eq(schema.users.id, user.id));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
