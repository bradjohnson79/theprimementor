ALTER TABLE "invoices"
ALTER COLUMN "currency" SET DEFAULT 'CAD';

ALTER TABLE "orders"
ALTER COLUMN "currency" SET DEFAULT 'CAD';

UPDATE "booking_types"
SET "currency" = 'CAD'
WHERE "id" = 'mentoring-circle-prime-law';
