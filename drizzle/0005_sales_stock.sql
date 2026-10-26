CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" integer,
	"title" text NOT NULL,
	"unit_name" text,
	"qty" numeric(12, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_name" text,
	"sale_date" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustment_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"adjustment_id" integer NOT NULL,
	"product_id" integer,
	"title" text NOT NULL,
	"unit_name" text,
	"qty" numeric(12, 3) NOT NULL,
	"cost" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"adj_date" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text DEFAULT 'dismantle' NOT NULL,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_adjustment_id_stock_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id","line_no");--> statement-breakpoint
CREATE INDEX "stock_adjustment_items_adj_idx" ON "stock_adjustment_items" USING btree ("adjustment_id");