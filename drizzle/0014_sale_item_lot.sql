ALTER TABLE "sale_items" ADD COLUMN "lot_id" integer;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_lot_id_bills_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- existing lines picked from a purchase line belong to that line's lot
UPDATE "sale_items" si SET "lot_id" = bi.bill_id FROM "bill_items" bi WHERE bi.id = si.source_item_id;
