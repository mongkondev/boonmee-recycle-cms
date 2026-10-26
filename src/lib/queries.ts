import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { MenuSnapshot } from "./menu";
import type { CategoryTree, ProductRow, ShopSettings, Unit } from "./types";

type Executor = Pick<typeof db, "execute">;

export async function getProducts(exec: Executor = db): Promise<ProductRow[]> {
  const rows = await exec.execute<Record<string, unknown>>(sql`
    select p.id, p.title, p.description, p.image_id, p.price, p.draft_price, p.price_note, p.unit_id, u.name as unit_name,
           p.is_active, p.sort_order, p.sub_category_id, sc.name as sub_name, coalesce(sc.is_active, true) as sub_active,
           p.main_category_id, mc.name as main_name, mc.is_active as main_active,
           lh.old_price as prev_price, lh.changed_at as last_changed
    from products p
    join main_categories mc on mc.id = p.main_category_id
    left join sub_categories sc on sc.id = p.sub_category_id
    left join units u on u.id = p.unit_id
    left join lateral (
      select h.old_price, h.changed_at from price_history h
      where h.product_id = p.id order by h.changed_at desc, h.id desc limit 1
    ) lh on true
    -- products without a sub category come first inside their main category
    order by mc.sort_order, mc.id, sc.sort_order nulls first, sc.id nulls first, p.sort_order, p.id
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
    subCategoryId: r.sub_category_id as number | null,
    subName: r.sub_name as string | null,
    subActive: r.sub_active as boolean,
    mainCategoryId: r.main_category_id as number,
    mainName: r.main_name as string,
    mainActive: r.main_active as boolean,
    prevPrice: r.prev_price === null ? null : Number(r.prev_price),
    lastChanged: r.last_changed ? new Date(r.last_changed as string).toISOString() : null,
  }));
}

export async function getCategoryTree(): Promise<CategoryTree> {
  const mains = await db.execute<{ id: number; name: string; sort_order: number; is_active: boolean; direct_count: number }>(sql`
    select m.id, m.name, m.sort_order, m.is_active,
           (select count(*)::int from products p where p.main_category_id = m.id and p.sub_category_id is null) as direct_count
    from main_categories m order by m.sort_order, m.id
  `);
  const subs = await db.execute<{ id: number; main_category_id: number; name: string; sort_order: number; is_active: boolean; product_count: number }>(sql`
    select sc.id, sc.main_category_id, sc.name, sc.sort_order, sc.is_active,
           (select count(*)::int from products p where p.sub_category_id = sc.id) as product_count
    from sub_categories sc order by sc.sort_order, sc.id
  `);
  return mains.map((m) => ({
    id: m.id,
    name: m.name,
    sortOrder: m.sort_order,
    isActive: m.is_active,
    directCount: m.direct_count,
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
  address: "",
  open_hours: "",
  hours: "",
  line_url: "",
  facebook: "",
  website: "",
  logo_image: "",
  line_qr_image: "",
  bank_name: "",
  bank_account: "",
  bank_account_name: "",
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
    join main_categories mc on mc.id = p.main_category_id
    left join sub_categories sc on sc.id = p.sub_category_id
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
    subName: r.sub_name as string | null,
    unitName: r.unit_name as string | null,
  }));
}

/** One page of publications, newest first, optionally within Bangkok calendar days `from`..`to`. */
export async function getPublications(opts: { page?: number; perPage?: number; from?: string | null; to?: string | null } = {}) {
  const perPage = opts.perPage ?? 100;
  const page = Math.max(1, opts.page ?? 1);
  const day = sql`(pb.published_at at time zone 'Asia/Bangkok')::date`;
  const where = sql`where ${opts.from ? sql`${day} >= ${opts.from}::date` : sql`true`} and ${opts.to ? sql`${day} <= ${opts.to}::date` : sql`true`}`;
  const [rows, [{ total }]] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      select pb.id, pb.note, pb.change_count, pb.published_at, coalesce(u.display_name, u.email, u.username) as published_by,
             (select count(*)::int from publication_pages pp where pp.publication_id = pb.id) as page_count,
             (select json_agg(pp.image_id order by pp.page_no) from publication_pages pp where pp.publication_id = pb.id) as page_ids
      from publications pb left join users u on u.id = pb.published_by
      ${where}
      order by pb.published_at desc, pb.id desc limit ${perPage} offset ${(page - 1) * perPage}
    `),
    db.execute<{ total: number }>(sql`select count(*)::int as total from publications pb ${where}`),
  ]);
  return { total, items: rows.map((r) => ({
    id: r.id as number,
    note: r.note as string | null,
    changeCount: r.change_count as number,
    publishedAt: new Date(r.published_at as string).toISOString(),
    publishedBy: r.published_by as string | null,
    pageCount: r.page_count as number,
    pageIds: (r.page_ids as string[] | null) ?? [],
  })) };
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

export async function getBills(search = "", limit = 200) {
  const q = search.trim();
  const like = `%${q}%`;
  const rows = await db.execute<Record<string, unknown>>(sql`
    select b.id, b.bill_no, b.lot_no, b.lot_note, b.customer_name, b.bill_date, b.payment_method, b.total,
           (select count(*)::int from bill_items i where i.bill_id = b.id) as item_count,
           coalesce(u.display_name, u.email, u.username) as created_by
    from bills b left join users u on u.id = b.created_by
    ${q ? sql`where b.customer_name ilike ${like} or b.lot_no ilike ${like} or b.lot_note ilike ${like} or b.bill_no::text = ${q.replace(/^#?0*/, "")}
      or exists (select 1 from bill_items i where i.bill_id = b.id and i.title ilike ${like})` : sql``}
    order by b.bill_date desc, b.id desc limit ${limit}
  `);
  return rows.map((r) => ({
    id: r.id as number,
    billNo: r.bill_no as number | null,
    lotNo: r.lot_no as string,
    lotNote: r.lot_note as string | null,
    customerName: r.customer_name as string | null,
    billDate: new Date(r.bill_date as string).toISOString(),
    paymentMethod: r.payment_method as "cash" | "transfer",
    total: Number(r.total),
    itemCount: r.item_count as number,
    createdBy: r.created_by as string | null,
  }));
}

export async function getBill(id: number) {
  const bill = await db.query.bills.findFirst({ where: eq(schema.bills.id, id) });
  if (!bill) return null;
  const items = await db
    .select()
    .from(schema.billItems)
    .where(eq(schema.billItems.billId, id))
    .orderBy(asc(schema.billItems.lineNo));
  const customer = bill.customerId ? await db.query.customers.findFirst({ where: eq(schema.customers.id, bill.customerId) }) : null;
  return {
    id: bill.id,
    billNo: bill.billNo,
    lotNo: bill.lotNo,
    lotNote: bill.lotNote,
    lotClosed: bill.lotClosedAt !== null,
    customerName: bill.customerName,
    customer: customer ? { phone: customer.phone, bankName: customer.bankName, bankAccount: customer.bankAccount } : null,
    billDate: bill.billDate.toISOString(),
    paymentMethod: bill.paymentMethod,
    total: bill.total,
    note: bill.note,
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      title: i.title,
      unitName: i.unitName,
      qty: i.qty,
      unitPrice: i.unitPrice,
      amount: i.amount,
    })),
  };
}

export type BillDetail = NonNullable<Awaited<ReturnType<typeof getBill>>>;

/** Products offered in the bill form, priced at the latest published price. */
export async function getBillProducts() {
  const rows = await getProducts();
  return rows
    .filter((p) => p.isActive && p.mainActive && p.subActive)
    .map((p) => ({
      key: `p${p.id}|${p.unitName ?? ""}`,
      productId: p.id as number | null,
      title: p.title,
      group: p.subName ? `${p.mainName} › ${p.subName}` : p.mainName,
      unitName: p.unitName,
      // the newest price: a draft waiting for publish wins over the published one
      price: ((p.draftPrice ?? p.price) || null) as number | null,
    }));
}
