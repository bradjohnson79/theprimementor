-- Make client_id nullable for guest mode support
ALTER TABLE "reports" ALTER COLUMN "client_id" DROP NOT NULL;
