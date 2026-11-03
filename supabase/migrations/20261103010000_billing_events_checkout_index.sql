-- O webhook do Asaas encontra a empresa de um checkout pelos avisos do próprio checkout
CREATE INDEX IF NOT EXISTS idx_billing_events_checkout_id
  ON public.billing_events ((payload -> 'checkout' ->> 'id'))
  WHERE event LIKE 'CHECKOUT_%';
