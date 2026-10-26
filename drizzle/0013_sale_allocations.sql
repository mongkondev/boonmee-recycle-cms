CREATE TABLE "sale_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_item_id" integer NOT NULL,
	"bill_item_id" integer NOT NULL,
	"qty" numeric(12, 3),
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "auto_lot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_allocations" ADD CONSTRAINT "sale_allocations_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_allocations" ADD CONSTRAINT "sale_allocations_bill_item_id_bill_items_id_fk" FOREIGN KEY ("bill_item_id") REFERENCES "public"."bill_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_allocations_item_idx" ON "sale_allocations" USING btree ("sale_item_id");--> statement-breakpoint
CREATE INDEX "sale_allocations_bill_item_idx" ON "sale_allocations" USING btree ("bill_item_id");--> statement-breakpoint
-- existing sales: each line picked from a purchase line keeps its whole amount on that line (totals unchanged);
-- the quantity counts only when the same item was sold in the same unit
INSERT INTO "sale_allocations" ("sale_item_id", "bill_item_id", "qty", "amount")
SELECT si.id, si.source_item_id,
       CASE WHEN coalesce(si.unit_name, '') = coalesce(bi.unit_name, '')
             AND (si.product_id = bi.product_id OR lower(trim(si.title)) = lower(trim(bi.title)))
            THEN si.qty END,
       si.amount
FROM "sale_items" si JOIN "bill_items" bi ON bi.id = si.source_item_id;
