ALTER TABLE "products" ALTER COLUMN "sub_category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "main_category_id" integer;--> statement-breakpoint
UPDATE "products" p SET "main_category_id" = sc."main_category_id" FROM "sub_categories" sc WHERE sc."id" = p."sub_category_id";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "main_category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_main_category_id_main_categories_id_fk" FOREIGN KEY ("main_category_id") REFERENCES "public"."main_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_main_idx" ON "products" USING btree ("main_category_id");
