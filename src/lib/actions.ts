"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "./auth";
import type { ShopSettings } from "./types";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

function revalidateAll() {
  for (const p of ["/prices", "/products", "/categories", "/units", "/export", "/history"]) revalidatePath(p);
}

function isFkViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23503" || err?.cause?.code === "23503";
}

/* ---------------- prices ---------------- */

const priceSchema = z.number().finite().min(0, "ราคาต้องไม่ติดลบ").max(9_999_999_999);

export async function updatePrice(
  productId: number,
  newPrice: number,
): Promise<ActionResult<{ price: number; prevPrice: number | null; changedAt: string | null }>> {
  const user = await requireUser();
  const parsed = priceSchema.safeParse(newPrice);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const price = Math.round(parsed.data * 100) / 100;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ price: schema.products.price })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .for("update");
    if (!current) return fail("ไม่พบสินค้า");
    if (current.price === price) return { ok: true as const, data: { price, prevPrice: null, changedAt: null } };

    const now = new Date();
    await tx.update(schema.products).set({ price, updatedAt: now }).where(eq(schema.products.id, productId));
    await tx.insert(schema.priceHistory).values({
      productId,
      oldPrice: current.price,
      newPrice: price,
      changedBy: user.id,
      changedAt: now,
    });
    // no revalidatePath here: every CMS page is dynamic, and skipping it keeps Enter-to-save snappy
    return { ok: true as const, data: { price, prevPrice: current.price, changedAt: now.toISOString() } };
  });
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
    if (isFkViolation(e)) return fail("ลบไม่ได้: ยังมีสินค้าอยู่ในหมวดย่อย กรุณาย้ายหรือลบสินค้าก่อน");
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
  subCategoryId: z.number({ message: "กรุณาเลือกหมวดหมู่ย่อย" }).int(),
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

  const savedId = await db.transaction(async (tx) => {
    if (id) {
      const [current] = await tx.select().from(schema.products).where(eq(schema.products.id, id)).for("update");
      if (!current) throw new Error("not found");
      await tx.update(schema.products).set({ ...data, updatedAt: new Date() }).where(eq(schema.products.id, id));
      if (current.price !== data.price) {
        await tx.insert(schema.priceHistory).values({ productId: id, oldPrice: current.price, newPrice: data.price, changedBy: user.id });
      }
      // drop the previous image once it is no longer referenced
      if (current.imageId && current.imageId !== data.imageId) {
        await tx.delete(schema.images).where(eq(schema.images.id, current.imageId));
      }
      return id;
    }
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(sort_order), -1)::int` })
      .from(schema.products)
      .where(eq(schema.products.subCategoryId, data.subCategoryId));
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
    if (input.next.length < 8) return fail("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
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
