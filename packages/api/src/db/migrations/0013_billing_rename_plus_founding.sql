ALTER TABLE "users" RENAME COLUMN "stripe_customer_id" TO "billing_customer_id";
ALTER TABLE "users" ADD COLUMN "is_founding_member" boolean DEFAULT false NOT NULL;
