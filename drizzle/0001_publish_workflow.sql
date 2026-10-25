CREATE TABLE "publication_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"publication_id" integer NOT NULL,
	"page_no" integer NOT NULL,
	"image_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" serial PRIMARY KEY NOT NULL,
	"note" text,
	"change_count" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by" integer,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD COLUMN "publication_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "draft_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "publication_pages" ADD CONSTRAINT "publication_pages_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_pages" ADD CONSTRAINT "publication_pages_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publication_pages_pub_idx" ON "publication_pages" USING btree ("publication_id","page_no");--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;