CREATE TABLE "stock_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"title" text NOT NULL,
	"unit_name" text,
	"qty" numeric(12, 3) NOT NULL,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_allocations" ALTER COLUMN "bill_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_allocations" ADD COLUMN "stock_in_id" integer;--> statement-breakpoint
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ins" ADD CONSTRAINT "stock_ins_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_ins_product_idx" ON "stock_ins" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "sale_allocations" ADD CONSTRAINT "sale_allocations_stock_in_id_stock_ins_id_fk" FOREIGN KEY ("stock_in_id") REFERENCES "public"."stock_ins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_allocations_stock_in_idx" ON "sale_allocations" USING btree ("stock_in_id");--> statement-breakpoint
ALTER TABLE "sale_allocations" ADD CONSTRAINT "sale_allocations_one_source" CHECK (("sale_allocations"."bill_item_id" is null) <> ("sale_allocations"."stock_in_id" is null));