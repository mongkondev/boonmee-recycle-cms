ALTER TABLE "stock_adjustment_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_adjustments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "stock_adjustment_items" CASCADE;--> statement-breakpoint
DROP TABLE "stock_adjustments" CASCADE;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "lot_no" text;--> statement-breakpoint
UPDATE "bills" b SET "lot_no" = x.lot FROM (
  SELECT id, 'LOT-BM' || to_char(bill_date at time zone 'Asia/Bangkok', 'YYYYMMDD')
         || lpad((row_number() over (partition by (bill_date at time zone 'Asia/Bangkok')::date order by bill_date, id))::text, 4, '0') AS lot
  FROM "bills"
) x WHERE x.id = b.id;--> statement-breakpoint
ALTER TABLE "bills" ALTER COLUMN "lot_no" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "lot_note" text;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "lot_closed_at" timestamp with time zone;--> statement-breakpoint
DELETE FROM "sales" WHERE id IN (SELECT sale_id FROM "sale_items");--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "source_item_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_source_item_id_bill_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."bill_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_lot_no_unique" UNIQUE("lot_no");