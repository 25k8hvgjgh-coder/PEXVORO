-- Keep the checked-in fresh-install schema compatible with the current marketplace app.
-- The app stores user-entered prices as decimal USD in public.marketplace_listings.price.
-- price_cents remains nullable for compatibility with earlier clients.
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS price numeric;

UPDATE public.marketplace_listings
SET price = price_cents::numeric / 100
WHERE price IS NULL AND price_cents IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.marketplace_listings WHERE price IS NULL OR price <= 0) THEN
    RAISE EXCEPTION 'Marketplace migration stopped: every existing listing must have a positive price before price can be required.';
  END IF;
END;
$$;

ALTER TABLE public.marketplace_listings
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN price_cents DROP NOT NULL;

ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'Good',
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accepted_responsibility boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_shipping_terms text NOT NULL DEFAULT 'Buyer and seller must agree on shipping, delivery, payment, returns, and all transaction details directly.',
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_price_check;
ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_price_check CHECK (price > 0 AND price <= 1000000);

ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_status_check;
ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_status_check CHECK (status IN ('draft','active','paused','sold','hidden','removed'));
