CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "customers" ("name") SELECT DISTINCT trim(name) FROM (
  SELECT customer_name AS name FROM "bills" UNION SELECT buyer_name FROM "sales"
) n WHERE coalesce(trim(name), '') <> '' ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "bills" b SET "customer_id" = c.id FROM "customers" c WHERE c.name = trim(b.customer_name);--> statement-breakpoint
UPDATE "sales" s SET "customer_id" = c.id FROM "customers" c WHERE c.name = trim(s.buyer_name);
