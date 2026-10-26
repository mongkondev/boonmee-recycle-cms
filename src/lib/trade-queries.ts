import "server-only";
import { asc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getBillProducts } from "./queries";

const BKK = sql.raw("'Asia/Bangkok'");
const ITEM_KEY = sql.raw(`coalesce('p' || m.product_id, 't' || lower(trim(m.title))) || '|' || coalesce(m.unit_name, '')`);
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------------- lots ---------------- */

/**
 * A lot is one purchase. Its money is tracked, not its quantities: whatever is sold out of it
 * (often a different item, e.g. copper out of a fridge) is deducted from what it cost.
 */
export type LotSummary = {
  id: number;
  lotNo: string;
  lotNote: string | null;
  billNo: number | null;
  date: string;
  customerName: string | null;
  closed: boolean;
  itemCount: number;
  titles: string;
  cost: number;
  sold: number;
  /** cost not yet recovered by sales (never below zero) */
  remaining: number;
  profit: number;
};

export async function getLots(opts: { id?: number; open?: boolean; search?: string; limit?: number } = {}): Promise<LotSummary[]> {
  const q = opts.search?.trim();
  const like = `%${q}%`;
  const rows = await db.execute<Record<string, unknown>>(sql`
    select b.id, b.lot_no, b.lot_note, b.bill_no, b.bill_date, b.customer_name, b.lot_closed_at, b.total,
           (select count(*)::int from bill_items i where i.bill_id = b.id) as item_count,
           (select string_agg(i.title, ', ' order by i.line_no) from bill_items i where i.bill_id = b.id) as titles,
           coalesce((select sum(si.amount) from sale_items si join bill_items i on i.id = si.source_item_id where i.bill_id = b.id), 0) as sold
    from bills b
    where true
      ${opts.id ? sql`and b.id = ${opts.id}` : sql``}
      ${opts.open === true ? sql`and b.lot_closed_at is null` : opts.open === false ? sql`and b.lot_closed_at is not null` : sql``}
      ${q ? sql`and (b.lot_no ilike ${like} or b.lot_note ilike ${like} or b.customer_name ilike ${like}
        or exists (select 1 from bill_items i where i.bill_id = b.id and i.title ilike ${like}))` : sql``}
    order by b.lot_closed_at is not null, b.bill_date desc, b.id desc
    limit ${opts.limit ?? 300}
  `);
  return rows.map((r) => {
    const cost = Number(r.total);
    const sold = Number(r.sold);
    return {
      id: r.id as number,
      lotNo: r.lot_no as string,
      lotNote: r.lot_note as string | null,
      billNo: r.bill_no as number | null,
      date: new Date(r.bill_date as string).toISOString(),
      customerName: r.customer_name as string | null,
      closed: r.lot_closed_at !== null,
      itemCount: r.item_count as number,
      titles: (r.titles as string | null) ?? "",
      cost,
      sold,
      remaining: Math.max(0, round2(cost - sold)),
      profit: round2(sold - cost),
    };
  });
}

/** One lot with its purchase lines and every sale line deducted from it. */
export async function getLot(id: number) {
  const [lot] = await getLots({ id });
  if (!lot) return null;
  const items = await db.execute<Record<string, unknown>>(sql`
    select i.id, i.title, i.unit_name, i.qty, i.amount,
           coalesce((select sum(si.amount) from sale_items si where si.source_item_id = i.id), 0) as sold
    from bill_items i where i.bill_id = ${id} order by i.line_no
  `);
  const sales = await db.execute<Record<string, unknown>>(sql`
    select si.id, s.id as sale_id, s.sale_date, s.buyer_name, si.title, si.unit_name, si.qty, si.unit_price, si.amount, i.title as source_title
    from sale_items si join sales s on s.id = si.sale_id join bill_items i on i.id = si.source_item_id
    where i.bill_id = ${id} order by s.sale_date desc, si.id
  `);
  return {
    ...lot,
    items: items.map((r) => {
      const cost = Number(r.amount);
      const sold = Number(r.sold);
      return {
        id: r.id as number,
        title: r.title as string,
        unitName: r.unit_name as string | null,
        qty: Number(r.qty),
        cost,
        sold,
        remaining: Math.max(0, round2(cost - sold)),
      };
    }),
    sales: sales.map((r) => ({
      id: r.id as number,
      saleId: r.sale_id as number,
      saleDate: new Date(r.sale_date as string).toISOString(),
      buyerName: r.buyer_name as string | null,
      title: r.title as string,
      unitName: r.unit_name as string | null,
      qty: Number(r.qty),
      unitPrice: Number(r.unit_price),
      amount: Number(r.amount),
      sourceTitle: r.source_title as string,
    })),
  };
}

export type SourceOption = {
  id: number;
  lotId: number;
  lotNo: string;
  lotNote: string | null;
  customerName: string | null;
  productId: number | null;
  title: string;
  unitName: string | null;
  qty: number;
  cost: number;
  /** sold so far, not counting the sale being edited */
  sold: number;
  remaining: number;
};

/** Purchase lines a sale can be deducted from: open lots, plus lines the edited sale already uses. */
export async function getSourceOptions(excludeSaleId = 0): Promise<SourceOption[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select i.id, b.id as lot_id, b.lot_no, b.lot_note, b.customer_name, i.product_id, i.title, i.unit_name, i.qty, i.amount,
           coalesce((select sum(si.amount) from sale_items si where si.source_item_id = i.id and si.sale_id <> ${excludeSaleId}), 0) as sold
    from bill_items i join bills b on b.id = i.bill_id
    where b.lot_closed_at is null
       or exists (select 1 from sale_items si where si.source_item_id = i.id and si.sale_id = ${excludeSaleId})
    order by b.bill_date desc, b.id desc, i.line_no
  `);
  return rows.map((r) => {
    const cost = Number(r.amount);
    const sold = Number(r.sold);
    return {
      id: r.id as number,
      lotId: r.lot_id as number,
      lotNo: r.lot_no as string,
      lotNote: r.lot_note as string | null,
      customerName: r.customer_name as string | null,
      productId: r.product_id as number | null,
      title: r.title as string,
      unitName: r.unit_name as string | null,
      qty: Number(r.qty),
      cost,
      sold,
      remaining: Math.max(0, round2(cost - sold)),
    };
  });
}

/** Catalogue items that can be sold, priced at the last selling price of each. */
export async function getSellProducts() {
  const [products, last] = await Promise.all([
    getBillProducts(),
    db.execute<{ product_id: number; unit_price: string }>(sql`
      select distinct on (si.product_id) si.product_id, si.unit_price
      from sale_items si join sales s on s.id = si.sale_id
      where si.product_id is not null order by si.product_id, s.sale_date desc, si.id desc
    `),
  ]);
  const price = new Map(last.map((r) => [r.product_id, Number(r.unit_price)]));
  return products.map((p) => ({ ...p, price: price.get(p.productId!) ?? null }));
}

/* ---------------- sales & customers ---------------- */

export async function getSales(search = "", limit = 200) {
  const q = search.trim();
  const like = `%${q}%`;
  const rows = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.buyer_name, s.sale_date, s.payment_method, s.total,
           (select count(*)::int from sale_items i where i.sale_id = s.id) as item_count,
           (select string_agg(distinct b.lot_no, ', ') from sale_items si join bill_items i on i.id = si.source_item_id
              join bills b on b.id = i.bill_id where si.sale_id = s.id) as lots
    from sales s
    ${q ? sql`where s.buyer_name ilike ${like} or s.id::text = ${q.replace(/^[#sS]?0*/, "")}
      or exists (select 1 from sale_items i where i.sale_id = s.id and i.title ilike ${like})
      or exists (select 1 from sale_items si join bill_items i on i.id = si.source_item_id join bills b on b.id = i.bill_id
                 where si.sale_id = s.id and b.lot_no ilike ${like})` : sql``}
    order by s.sale_date desc, s.id desc limit ${limit}
  `);
  return rows.map((r) => ({
    id: r.id as number,
    buyerName: r.buyer_name as string | null,
    saleDate: new Date(r.sale_date as string).toISOString(),
    paymentMethod: r.payment_method as "cash" | "transfer",
    total: Number(r.total),
    itemCount: r.item_count as number,
    lots: (r.lots as string | null) ?? "",
  }));
}

export async function getSale(id: number) {
  const sale = await db.query.sales.findFirst({ where: eq(schema.sales.id, id) });
  if (!sale) return null;
  const items = await db.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, id)).orderBy(asc(schema.saleItems.lineNo));
  const customer = sale.customerId ? await db.query.customers.findFirst({ where: eq(schema.customers.id, sale.customerId) }) : null;
  return { ...sale, saleDate: sale.saleDate.toISOString(), items, customer: customer ?? null };
}

export type Customer = { id: number; name: string; phone: string | null; bankName: string | null; bankAccount: string | null };

export async function getCustomers(): Promise<Customer[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select c.id, c.name, c.phone, c.bank_name, c.bank_account,
           greatest((select max(b.bill_date) from bills b where b.customer_id = c.id),
                    (select max(s.sale_date) from sales s where s.customer_id = c.id)) as last_used
    from customers c order by last_used desc nulls last, c.name
  `);
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    phone: r.phone as string | null,
    bankName: r.bank_name as string | null,
    bankAccount: r.bank_account as string | null,
  }));
}

/* ---------------- reports ---------------- */

/** Inclusive Bangkok calendar-day range; null = open ended. */
export type DayRange = { from: string | null; to: string | null };

const inRange = (col: SQL, r: DayRange) =>
  sql`${r.from ? sql`(${col} at time zone ${BKK})::date >= ${r.from}::date` : sql`true`}
      and ${r.to ? sql`(${col} at time zone ${BKK})::date <= ${r.to}::date` : sql`true`}`;

export async function getTotals(r: DayRange) {
  const [row] = await db.execute<Record<string, unknown>>(sql`
    select
      (select count(*)::int from bills b where ${inRange(sql`b.bill_date`, r)}) as buy_count,
      (select coalesce(sum(total), 0) from bills b where ${inRange(sql`b.bill_date`, r)}) as buy_amount,
      (select coalesce(sum(total), 0) from bills b where b.payment_method = 'cash' and ${inRange(sql`b.bill_date`, r)}) as buy_cash,
      (select count(*)::int from sales s where ${inRange(sql`s.sale_date`, r)}) as sell_count,
      (select coalesce(sum(total), 0) from sales s where ${inRange(sql`s.sale_date`, r)}) as sell_amount,
      (select count(*)::int from bills b where b.lot_closed_at is not null and ${inRange(sql`b.lot_closed_at`, r)}) as closed_count,
      (select coalesce(sum(
         coalesce((select sum(si.amount) from sale_items si join bill_items i on i.id = si.source_item_id where i.bill_id = b.id), 0) - b.total
       ), 0) from bills b where b.lot_closed_at is not null and ${inRange(sql`b.lot_closed_at`, r)}) as closed_profit
  `);
  return {
    buyCount: row.buy_count as number,
    buyAmount: Number(row.buy_amount),
    buyCash: Number(row.buy_cash),
    sellCount: row.sell_count as number,
    sellAmount: Number(row.sell_amount),
    /** lots closed in the range: what they sold minus what they cost */
    closedCount: row.closed_count as number,
    closedProfit: Number(row.closed_profit),
  };
}

/** Buy and sell amount per Bangkok day, every day in the range (zero days included). */
export async function getDaily(from: string, to: string) {
  const rows = await db.execute<{ day: string; buy: string; sell: string }>(sql`
    select to_char(d, 'YYYY-MM-DD') as day,
      (select coalesce(sum(total), 0) from bills b where (b.bill_date at time zone ${BKK})::date = d) as buy,
      (select coalesce(sum(total), 0) from sales s where (s.sale_date at time zone ${BKK})::date = d) as sell
    from generate_series(${from}::date, ${to}::date, interval '1 day') as g(d)
    order by d
  `);
  return rows.map((r) => ({ day: r.day, buy: Number(r.buy), sell: Number(r.sell) }));
}

/** Per item: quantities and money bought / sold inside the range. */
export async function getItemReport(r: DayRange) {
  const rows = await db.execute<Record<string, unknown>>(sql`
    with m as (
      select bi.product_id, bi.title, bi.unit_name, bi.qty as buy_qty, bi.amount as buy_amount, 0 as sell_qty, 0 as sell_amount
      from bill_items bi join bills b on b.id = bi.bill_id where ${inRange(sql`b.bill_date`, r)}
      union all
      select si.product_id, si.title, si.unit_name, 0, 0, si.qty, si.amount
      from sale_items si join sales s on s.id = si.sale_id where ${inRange(sql`s.sale_date`, r)}
    )
    select ${ITEM_KEY} as key, max(m.title) as title, max(m.unit_name) as unit_name,
           sum(buy_qty) as buy_qty, sum(buy_amount) as buy_amount, sum(sell_qty) as sell_qty, sum(sell_amount) as sell_amount
    from m group by 1 order by sum(buy_amount) + sum(sell_amount) desc
  `);
  return rows.map((x) => ({
    key: x.key as string,
    title: x.title as string,
    unitName: x.unit_name as string | null,
    buyQty: Number(x.buy_qty),
    buyAmount: Number(x.buy_amount),
    sellQty: Number(x.sell_qty),
    sellAmount: Number(x.sell_amount),
  }));
}

export async function getAttachments(target: { billId: number } | { saleId: number }) {
  const col = "billId" in target ? schema.attachments.billId : schema.attachments.saleId;
  const id = "billId" in target ? target.billId : target.saleId;
  return db
    .select({ id: schema.attachments.id, imageId: schema.attachments.imageId, kind: schema.attachments.kind, createdAt: schema.attachments.createdAt })
    .from(schema.attachments)
    .where(eq(col, id))
    .orderBy(asc(schema.attachments.id));
}

/** Customers with what the shop bought from / sold to each of them. */
export async function getCustomerStats(search = "") {
  const q = search.trim();
  const like = `%${q}%`;
  const rows = await db.execute<Record<string, unknown>>(sql`
    select c.id, c.name, c.phone, c.bank_name, c.bank_account,
           (select count(*)::int from bills b where b.customer_id = c.id) as buy_count,
           (select coalesce(sum(total), 0) from bills b where b.customer_id = c.id) as buy_amount,
           (select count(*)::int from sales s where s.customer_id = c.id) as sell_count,
           (select coalesce(sum(total), 0) from sales s where s.customer_id = c.id) as sell_amount,
           greatest((select max(b.bill_date) from bills b where b.customer_id = c.id),
                    (select max(s.sale_date) from sales s where s.customer_id = c.id)) as last_used
    from customers c
    ${q ? sql`where c.name ilike ${like} or c.phone ilike ${like} or c.bank_account ilike ${like}` : sql``}
    order by last_used desc nulls last, c.name
  `);
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    phone: r.phone as string | null,
    bankName: r.bank_name as string | null,
    bankAccount: r.bank_account as string | null,
    buyCount: r.buy_count as number,
    buyAmount: Number(r.buy_amount),
    sellCount: r.sell_count as number,
    sellAmount: Number(r.sell_amount),
    lastUsed: r.last_used ? new Date(r.last_used as string).toISOString() : null,
  }));
}
