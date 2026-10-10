-- Align ReconFeed Market fields with the mobile client. Existing prices remain in cents.
BEGIN;
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'Good',
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accepted_responsibility boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_shipping_terms text NOT NULL DEFAULT '';
COMMIT;
