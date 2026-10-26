import {
  boolean,
  customType,
  jsonb,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

// numeric comes back from postgres as string; keep it as number in app code
const money = customType<{ data: number; driverData: string }>({
  dataType: () => "numeric(12, 2)",
  fromDriver: (v) => Number(v),
  toDriver: (v) => String(v),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // legacy login name (pre-email); kept nullable for old rows
  username: text("username").unique(),
  email: text("email").unique(),
  role: text("role", { enum: ["super", "admin"] }).notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  displayName: text("display_name"),
  passwordHash: text("password_hash").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mainCategories = pgTable("main_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subCategories = pgTable(
  "sub_categories",
  {
    id: serial("id").primaryKey(),
    mainCategoryId: integer("main_category_id")
      .notNull()
      .references(() => mainCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sub_categories_main_idx").on(t.mainCategoryId)],
);

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    mainCategoryId: integer("main_category_id")
      .notNull()
      .references(() => mainCategories.id, { onDelete: "restrict" }),
    // optional grouping inside the main category
    subCategoryId: integer("sub_category_id").references(() => subCategories.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
    price: money("price").notNull(),
    // pending price waiting for the next publish; null = no draft
    draftPrice: money("draft_price"),
    // optional display override for ranges such as "3000-30000" or "100+"
    priceNote: text("price_note"),
    unitId: integer("unit_id").references(() => units.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_main_idx").on(t.mainCategoryId), index("products_sub_idx").on(t.subCategoryId)],
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    oldPrice: money("old_price"),
    newPrice: money("new_price").notNull(),
    changedBy: integer("changed_by").references(() => users.id, { onDelete: "set null" }),
    publicationId: integer("publication_id").references(() => publications.id, { onDelete: "set null" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_history_product_idx").on(t.productId, t.changedAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** One "ประกาศราคา" — a publish of all draft prices, with a frozen copy of the menu at that moment. */
export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  note: text("note"),
  changeCount: integer("change_count").notNull().default(0),
  // { settings, mains: [{ name, sections: [{ name, items: [...] }] }] } — rendered later into A4 pages
  snapshot: jsonb("snapshot").notNull(),
  publishedBy: integer("published_by").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Rendered A4 menu pages for a publication (stored so they can be re-sent without re-rendering). */
export const publicationPages = pgTable(
  "publication_pages",
  {
    id: serial("id").primaryKey(),
    publicationId: integer("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    pageNo: integer("page_no").notNull(),
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
  },
  (t) => [index("publication_pages_pub_idx").on(t.publicationId, t.pageNo)],
);

/** Admin invitation link. Only the SHA-256 of the token is stored. */
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  role: text("role", { enum: ["super", "admin"] }).notNull().default("admin"),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: integer("invited_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** People the shop buys from or sells to. Saved automatically from the name typed on a bill / sale. */
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  phone: text("phone"),
  // for paying by transfer
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** บิลเงินสดรับซื้อ — what the shop paid a customer for the scrap they brought in. */
export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  // every row is a purchase (stock in); the printed bill number is given only once a bill is issued
  billNo: integer("bill_no").unique(),
  // every purchase is one lot: LOT-BM + yyyymmdd + running number of that day
  lotNo: text("lot_no").notNull().unique(),
  // internal note about the lot (not printed on the bill)
  lotNote: text("lot_note"),
  // closed lots are done (sold out) and no longer offered when selling
  lotClosedAt: timestamp("lot_closed_at", { withTimezone: true }),
  customerName: text("customer_name"),
  billDate: timestamp("bill_date", { withTimezone: true }).notNull().defaultNow(),
  paymentMethod: text("payment_method", { enum: ["cash", "transfer"] }).notNull().default("cash"),
  total: money("total").notNull().default(0),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billItems = pgTable(
  "bill_items",
  {
    id: serial("id").primaryKey(),
    billId: integer("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    // null for free-text lines; title/unit are copied so old bills never change
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    unitName: text("unit_name"),
    qty: numeric("qty", { precision: 12, scale: 3, mode: "number" }).notNull(),
    unitPrice: money("unit_price").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [index("bill_items_bill_idx").on(t.billId, t.lineNo)],
);

/** ขายออก — selling stock that was bought in (whole or split into parts) to a buyer / factory. */
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  buyerName: text("buyer_name"),
  saleDate: timestamp("sale_date", { withTimezone: true }).notNull().defaultNow(),
  paymentMethod: text("payment_method", { enum: ["cash", "transfer"] }).notNull().default("cash"),
  total: money("total").notNull().default(0),
  note: text("note"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    // the purchase line (and so the lot) the sale is deducted from, e.g. copper sold out of a bought fridge
    // null = sold from the mixed pile, not from a particular lot
    sourceItemId: integer("source_item_id").references(() => billItems.id, { onDelete: "restrict" }),
    // what was actually sold
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    unitName: text("unit_name"),
    qty: numeric("qty", { precision: 12, scale: 3, mode: "number" }).notNull(),
    unitPrice: money("unit_price").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId, t.lineNo)],
);

/** Payment slips (or other reference photos) attached to a purchase or a sale. */
export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    billId: integer("bill_id").references(() => bills.id, { onDelete: "cascade" }),
    saleId: integer("sale_id").references(() => sales.id, { onDelete: "cascade" }),
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    // slip = payment slip; bill = the buyer's own bill / receipt for a sale
    kind: text("kind", { enum: ["slip", "bill"] }).notNull().default("slip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_bill_idx").on(t.billId), index("attachments_sale_idx").on(t.saleId)],
);
