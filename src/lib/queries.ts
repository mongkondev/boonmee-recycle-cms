import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { MenuSnapshot } from "./menu";
import type { CategoryTree, ProductRow, ShopSettings, Unit } from "./types";

type Executor = Pick<typeof db, "execute">;

export async function getProducts(exec: Executor = db): Promise<ProductRow[]> {
  const rows = await exec.execute<Record<string, unknown>>(sql`
    select p.id, p.title, p.description, p.image_id, p.price, p.draft_price, p.price_note, p.unit_id, u.name as unit_name,
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
    draftPrice: r.draft_price === null ? null : Number(r.draft_price),
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
           coalesce(us.display_name, us.email, us.username) as changed_by, mc.name as main_name, sc.name as sub_name, u.name as unit_name
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

export async function getPublications() {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select pb.id, pb.note, pb.change_count, pb.published_at, coalesce(u.display_name, u.email, u.username) as published_by,
           (select count(*)::int from publication_pages pp where pp.publication_id = pb.id) as page_count,
           (select pp.image_id from publication_pages pp where pp.publication_id = pb.id order by pp.page_no limit 1) as cover_id
    from publications pb left join users u on u.id = pb.published_by
    order by pb.published_at desc, pb.id desc limit 100
  `);
  return rows.map((r) => ({
    id: r.id as number,
    note: r.note as string | null,
    changeCount: r.change_count as number,
    publishedAt: new Date(r.published_at as string).toISOString(),
    publishedBy: r.published_by as string | null,
    pageCount: r.page_count as number,
    coverId: r.cover_id as string | null,
  }));
}

export async function getPublication(id: number) {
  const pub = await db.query.publications.findFirst({ where: eq(schema.publications.id, id) });
  if (!pub) return null;
  const pages = await db
    .select({ pageNo: schema.publicationPages.pageNo, imageId: schema.publicationPages.imageId })
    .from(schema.publicationPages)
    .where(eq(schema.publicationPages.publicationId, id))
    .orderBy(asc(schema.publicationPages.pageNo));
  const changes = await db.execute<Record<string, unknown>>(sql`
    select h.id, p.title, h.old_price, h.new_price, u.name as unit_name
    from price_history h join products p on p.id = h.product_id left join units u on u.id = p.unit_id
    where h.publication_id = ${id} order by h.id
  `);
  return {
    id: pub.id,
    note: pub.note,
    changeCount: pub.changeCount,
    publishedAt: pub.publishedAt.toISOString(),
    snapshot: pub.snapshot as MenuSnapshot,
    pages,
    changes: changes.map((c) => ({
      id: c.id as number,
      title: c.title as string,
      oldPrice: c.old_price === null ? null : Number(c.old_price),
      newPrice: Number(c.new_price),
      unitName: c.unit_name as string | null,
    })),
  };
}

export async function getUsersAndInvites() {
  const users = await db.execute<Record<string, unknown>>(sql`
    select id, email, username, display_name, role, is_active, totp_enabled, created_at from users order by role desc, id
  `);
  const invites = await db.execute<Record<string, unknown>>(sql`
    select i.id, i.email, i.display_name, i.expires_at, i.created_at, coalesce(u.display_name, u.email) as invited_by
    from invitations i left join users u on u.id = i.invited_by
    where i.accepted_at is null order by i.created_at desc
  `);
  return {
    users: users.map((u) => ({
      id: u.id as number,
      email: (u.email ?? u.username) as string,
      displayName: u.display_name as string | null,
      role: u.role as "super" | "admin",
      isActive: u.is_active as boolean,
      totpEnabled: u.totp_enabled as boolean,
      createdAt: new Date(u.created_at as string).toISOString(),
    })),
    invites: invites.map((i) => ({
      id: i.id as number,
      email: i.email as string,
      displayName: i.display_name as string | null,
      expiresAt: new Date(i.expires_at as string).toISOString(),
      expired: new Date(i.expires_at as string) < new Date(),
      invitedBy: i.invited_by as string | null,
    })),
  };
}
