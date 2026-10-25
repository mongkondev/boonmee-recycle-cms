import "server-only";
import { asc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CategoryTree, ProductRow, ShopSettings, Unit } from "./types";

export async function getProducts(): Promise<ProductRow[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select p.id, p.title, p.description, p.image_id, p.price, p.price_note, p.unit_id, u.name as unit_name,
           p.is_active, p.sort_order, p.sub_category_id, sc.name as sub_name, sc.is_active as sub_active,
           sc.main_category_id, mc.name as main_name, mc.is_active as main_active,
           lh.old_price as prev_price, lh.changed_at as last_changed, sp.spark
    from products p
    join sub_categories sc on sc.id = p.sub_category_id
    join main_categories mc on mc.id = sc.main_category_id
    left join units u on u.id = p.unit_id
    left join lateral (
      select h.old_price, h.changed_at from price_history h
      where h.product_id = p.id order by h.changed_at desc, h.id desc limit 1
    ) lh on true
    left join lateral (
      select json_agg(x.new_price::float8 order by x.changed_at, x.id) as spark from (
        select h.new_price, h.changed_at, h.id from price_history h
        where h.product_id = p.id order by h.changed_at desc, h.id desc limit 10
      ) x
    ) sp on true
    order by mc.sort_order, mc.id, sc.sort_order, sc.id, p.sort_order, p.id
  `);
  return rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    description: r.description as string | null,
    imageId: r.image_id as string | null,
    price: Number(r.price),
    priceNote: r.price_note as string | null,
    unitId: r.unit_id as number | null,
    unitName: r.unit_name as string | null,
    isActive: r.is_active as boolean,
    sortOrder: r.sort_order as number,
    subCategoryId: r.sub_category_id as number,
    subName: r.sub_name as string,
    subActive: r.sub_active as boolean,
    mainCategoryId: r.main_category_id as number,
    mainName: r.main_name as string,
    mainActive: r.main_active as boolean,
    prevPrice: r.prev_price === null ? null : Number(r.prev_price),
    lastChanged: r.last_changed ? new Date(r.last_changed as string).toISOString() : null,
    spark: ((r.spark as number[] | null) ?? []).map(Number),
  }));
}

export async function getCategoryTree(): Promise<CategoryTree> {
  const mains = await db
    .select()
    .from(schema.mainCategories)
    .orderBy(asc(schema.mainCategories.sortOrder), asc(schema.mainCategories.id));
  const subs = await db.execute<{ id: number; main_category_id: number; name: string; sort_order: number; is_active: boolean; product_count: number }>(sql`
    select sc.id, sc.main_category_id, sc.name, sc.sort_order, sc.is_active,
           (select count(*)::int from products p where p.sub_category_id = sc.id) as product_count
    from sub_categories sc order by sc.sort_order, sc.id
  `);
  return mains.map((m) => ({
    id: m.id,
    name: m.name,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    subs: subs
      .filter((s) => s.main_category_id === m.id)
      .map((s) => ({ id: s.id, name: s.name, sortOrder: s.sort_order, isActive: s.is_active, productCount: s.product_count })),
  }));
}

export async function getUnits(): Promise<Unit[]> {
  const rows = await db.execute<{ id: number; name: string; sort_order: number; product_count: number }>(sql`
    select u.id, u.name, u.sort_order,
           (select count(*)::int from products p where p.unit_id = u.id) as product_count
    from units u order by u.sort_order, u.id
  `);
  return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order, productCount: r.product_count }));
}

export const DEFAULT_SETTINGS: ShopSettings = {
  shop_name: "ร้าน บุญมี รีไซเคิล",
  phones: "",
  tagline: "",
  open_hours: "",
  line_url: "",
  website: "",
};

export async function getSettings(): Promise<ShopSettings> {
  const rows = await db.select().from(schema.settings);
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

export async function getHistory(limit = 300) {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select h.id, h.product_id, p.title, h.old_price, h.new_price, h.changed_at,
           coalesce(us.display_name, us.username) as changed_by, mc.name as main_name, sc.name as sub_name, u.name as unit_name
    from price_history h
    join products p on p.id = h.product_id
    join sub_categories sc on sc.id = p.sub_category_id
    join main_categories mc on mc.id = sc.main_category_id
    left join units u on u.id = p.unit_id
    left join users us on us.id = h.changed_by
    where h.old_price is not null
    order by h.changed_at desc, h.id desc limit ${limit}
  `);
  return rows.map((r) => ({
    id: r.id as number,
    productId: r.product_id as number,
    title: r.title as string,
    oldPrice: Number(r.old_price),
    newPrice: Number(r.new_price),
    changedAt: new Date(r.changed_at as string).toISOString(),
    changedBy: r.changed_by as string | null,
    mainName: r.main_name as string,
    subName: r.sub_name as string,
    unitName: r.unit_name as string | null,
  }));
}
