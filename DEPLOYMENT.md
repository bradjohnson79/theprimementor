# Deployment Safety Rules

## Database migrations first

Never deploy schema-dependent code before the matching database migration has been applied.

Required order for any schema change:

1. Generate or add the Drizzle migration file.
2. Apply the migration to the target database.
3. Verify the new schema exists in the target environment.
4. Deploy the application code that depends on the schema.

## Orders invoice columns

For the `orders` Stripe invoice fields, the required columns are:

- `stripe_invoice_id`
- `stripe_invoice_url`
- `stripe_invoice_status`

If these columns are missing, the API startup schema guard should fail clearly so deployments do not proceed silently against an outdated database.
