create unique index if not exists payments_provider_payment_intent_uidx
  on payments (provider_payment_intent_id)
  where provider_payment_intent_id is not null;
