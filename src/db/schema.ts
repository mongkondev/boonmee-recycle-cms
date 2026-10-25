import {
  boolean,
  customType,
  jsonb,
  index,
  integer,
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
  username: text("username").notNull().unique(),
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
    subCategoryId: integer("sub_category_id")
      .notNull()
      .references(() => subCategories.id, { onDelete: "restrict" }),
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
  (t) => [index("products_sub_idx").on(t.subCategoryId)],
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
