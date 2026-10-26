import "server-only";
import { asc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";

type Exec = Pick<typeof db, "execute">;

const BKK = sql.raw("'Asia/Bangkok'");
const KEY = sql.raw(`coalesce('p' || m.product_id, 't' || lower(trim(m.title))) || '|' || coalesce(m.unit_name, '')`);

/** Every stock move: purchases in, sales out, dismantling out/in. `excludeSaleId` leaves one sale out (when editing it). */
const moves = (excludeSaleId = 0) => sql`
  select bi.product_id, bi.title, bi.unit_name, bi.qty, bi.amount as cost, b.bill_date as at, 'in' as kind
  from bill_items bi join bills b on b.id = bi.bill_id
  union all
  select si.product_id, si.title, si.unit_name, -si.qty, 0, s.sale_date, 'sale'
  from sale_items si join sales s on s.id = si.sale_id where s.id <> ${excludeSaleId}
  union all
  select ai.product_id, ai.title, ai.unit_name, ai.qty, ai.cost, a.adj_date, case when ai.qty > 0 then 'in' else 'out' end
  from stock_adjustment_items ai join stock_adjustments a on a.id = ai.adjustment_id
`;

export type StockItem = {
  key: string;
  productId: number | null;
  title: string;
  unitName: string | null;
  group: string;
  remaining: number;
  inQty: number;
  /** weighted average cost per unit of everything that came in */
  avgCost: number;
  value: number;
  lastSalePrice: number | null;
  lastAt: string;
};

export async function getStock(opts: { excludeSaleId?: number; exec?: Exec } = {}): Promise<StockItem[]> {
  const rows = await (opts.exec ?? db).execute<Record<string, unknown>>(sql`
    with m as (${moves(opts.excludeSaleId)}),
    k as (select m.*, ${KEY} as key from m),
    agg as (
      select key, max(product_id) as product_id, (array_agg(title order by at desc))[1] as title, max(unit_name) as unit_name,
             sum(qty) as remaining,
             coalesce(sum(qty) filter (where kind = 'in'), 0) as in_qty,
             coalesce(sum(cost) filter (where kind = 'in'), 0) as in_cost,
             max(at) as last_at
      from k group by key
    ),
    last_sale as (
      select distinct on (key) ${KEY} as key, m.unit_price
      from (select si.*, s.sale_date from sale_items si join sales s on s.id = si.sale_id) m
      order by key, m.sale_date desc, m.id desc
    )
    select agg.*, ls.unit_price as last_sale_price, coalesce(mc.name || coalesce(' › ' || sc.name, ''), 'ไม่อยู่ในรายการสินค้า') as grp
    from agg
    left join last_sale ls on ls.key = agg.key
    left join products p on p.id = agg.product_id
    left join main_categories mc on mc.id = p.main_category_id
    left join sub_categories sc on sc.id = p.sub_category_id
    order by agg.last_at desc
  `);
  return rows.map((r) => {
    const inQty = Number(r.in_qty);
    const avgCost = inQty > 0 ? Number(r.in_cost) / inQty : 0;
    const remaining = Math.round(Number(r.remaining) * 1000) / 1000;
    return {
      key: r.key as string,
      productId: r.product_id as number | null,
      title: r.title as string,
      unitName: r.unit_name as string | null,
      group: r.grp as string,
      remaining,
      inQty,
      avgCost,
      value: Math.round(remaining * avgCost * 100) / 100,
      lastSalePrice: r.last_sale_price === null ? null : Number(r.last_sale_price),
      lastAt: new Date(r.last_at as string).toISOString(),
    };
  });
}

export async function getSales(search = "", limit = 200) {
  const q = search.trim();
  const like = `%${q}%`;
  const rows = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.buyer_name, s.sale_date, s.payment_method, s.total,
           (select count(*)::int from sale_items i where i.sale_id = s.id) as item_count
    from sales s
    ${q ? sql`where s.buyer_name ilike ${like} or s.id::text = ${q.replace(/^#?0*/, "")}
      or exists (select 1 from sale_items i where i.sale_id = s.id and i.title ilike ${like})` : sql``}
    order by s.sale_date desc, s.id desc limit ${limit}
  `);
  return rows.map((r) => ({
    id: r.id as number,
    buyerName: r.buyer_name as string | null,
    saleDate: new Date(r.sale_date as string).toISOString(),
    paymentMethod: r.payment_method as "cash" | "transfer",
    total: Number(r.total),
    itemCount: r.item_count as number,
  }));
}

export async function getSale(id: number) {
  const sale = await db.query.sales.findFirst({ where: eq(schema.sales.id, id) });
  if (!sale) return null;
  const items = await db.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, id)).orderBy(asc(schema.saleItems.lineNo));
  return { ...sale, saleDate: sale.saleDate.toISOString(), items };
}

export async function getAdjustments(limit = 50) {
  const rows = await db.execute<Record<string, unknown>>(sql`
    select a.id, a.adj_date, a.note, coalesce(u.display_name, u.email) as created_by,
           json_agg(json_build_object('title', i.title, 'unitName', i.unit_name, 'qty', i.qty, 'cost', i.cost) order by i.qty, i.id) as items
    from stock_adjustments a join stock_adjustment_items i on i.adjustment_id = a.id
    left join users u on u.id = a.created_by
    group by a.id, u.display_name, u.email
    order by a.adj_date desc, a.id desc limit ${limit}
  `);
  return rows.map((r) => ({
    id: r.id as number,
    adjDate: new Date(r.adj_date as string).toISOString(),
    note: r.note as string | null,
    createdBy: r.created_by as string | null,
    items: (r.items as { title: string; unitName: string | null; qty: string | number; cost: string | number }[]).map((i) => ({
      ...i,
      qty: Number(i.qty),
      cost: Number(i.cost),
    })),
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
    with st as (
      select key, case when in_qty > 0 then in_cost / in_qty else 0 end as avg_cost from (
        select ${KEY} as key, coalesce(sum(qty) filter (where kind = 'in'), 0) as in_qty, coalesce(sum(cost) filter (where kind = 'in'), 0) as in_cost
        from (${moves()}) m group by 1
      ) x
    )
    select
      (select count(*)::int from bills b where ${inRange(sql`b.bill_date`, r)}) as buy_count,
      (select coalesce(sum(total), 0) from bills b where ${inRange(sql`b.bill_date`, r)}) as buy_amount,
      (select coalesce(sum(total), 0) from bills b where b.payment_method = 'cash' and ${inRange(sql`b.bill_date`, r)}) as buy_cash,
      (select count(*)::int from sales s where ${inRange(sql`s.sale_date`, r)}) as sell_count,
      (select coalesce(sum(total), 0) from sales s where ${inRange(sql`s.sale_date`, r)}) as sell_amount,
      (select coalesce(sum(m.qty * coalesce(st.avg_cost, 0)), 0)
         from sale_items m join sales s on s.id = m.sale_id left join st on st.key = ${KEY}
         where ${inRange(sql`s.sale_date`, r)}) as cogs
  `);
  const sell = Number(row.sell_amount);
  const cogs = Number(row.cogs);
  return {
    buyCount: row.buy_count as number,
    buyAmount: Number(row.buy_amount),
    buyCash: Number(row.buy_cash),
    sellCount: row.sell_count as number,
    sellAmount: sell,
    /** sales minus the average purchase cost of what was sold */
    profit: Math.round((sell - cogs) * 100) / 100,
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
    select ${KEY} as key, max(m.title) as title, max(m.unit_name) as unit_name,
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

/** Stock items that can still be sold, as picker options (price = last selling price). */
export async function getSellOptions(excludeSaleId?: number) {
  const stock = await getStock({ excludeSaleId });
  return stock
    .filter((s) => s.remaining > 0)
    .map((s) => ({
      key: s.key,
      productId: s.productId,
      title: s.title,
      group: s.group,
      unitName: s.unitName,
      price: s.lastSalePrice,
      remaining: s.remaining,
      avgCost: s.avgCost,
    }));
}
