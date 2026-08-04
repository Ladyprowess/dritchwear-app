-- Prevent a Paystack reference from being reused across multiple payment links.
-- A single verified transaction reference may only ever mark ONE pay-link paid.
-- This is the hard backstop behind the application-level replay check in the
-- `pay` edge function (metadata token binding + reference-reuse lookup).
CREATE UNIQUE INDEX IF NOT EXISTS payment_links_paystack_ref_unique
  ON public.payment_links (paystack_ref)
  WHERE paystack_ref IS NOT NULL;
