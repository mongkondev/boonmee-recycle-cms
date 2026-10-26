ALTER TABLE "bills" ADD COLUMN "bill_no" integer;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_bill_no_unique" UNIQUE("bill_no");--> statement-breakpoint
UPDATE "bills" SET "bill_no" = "id";
