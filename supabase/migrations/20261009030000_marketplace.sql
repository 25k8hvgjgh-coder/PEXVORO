-- ReconFeed Marketplace schema
-- Run through Supabase migrations / SQL editor, then verify policies before public launch.
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  category text not null check (category in ('Vehicles','Parts & Accessories','Tools & Equipment','Outdoor & Lifestyle','Other')),
  condition text not null default 'Good' check (condition in ('New','Like new','Good','Fair','For parts','Used')),
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  location text not null default '' check (char_length(location) <= 160),
  image_urls text[] not null default '{}',
  status text not null default 'active' check (status in ('active','sold','hidden','removed')),
  seller_shipping_terms text not null default 'Buyer and seller must agree on shipping, delivery, payment, returns, and all transaction details directly.' ,
  accepted_responsibility boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listing_responsibility_ack check (accepted_responsibility = true)
);
create index if not exists marketplace_listings_browse_idx on public.marketplace_listings(status, category, created_at desc);
create index if not exists marketplace_listings_seller_idx on public.marketplace_listings(seller_id, created_at desc);
alter table public.marketplace_listings enable row level security;
revoke all on public.marketplace_listings from anon, authenticated;
grant select on public.marketplace_listings to anon, authenticated;
grant insert, update, delete on public.marketplace_listings to authenticated;
drop policy if exists "Anyone can view active marketplace listings" on public.marketplace_listings;
create policy "Anyone can view active marketplace listings" on public.marketplace_listings
 for select to anon, authenticated using (status = 'active' or (select auth.uid()) = seller_id);
drop policy if exists "Sellers can create their own listings with acknowledgment" on public.marketplace_listings;
create policy "Sellers can create their own listings with acknowledgment" on public.marketplace_listings
 for insert to authenticated with check ((select auth.uid()) = seller_id and accepted_responsibility = true);
drop policy if exists "Sellers can update their own listings" on public.marketplace_listings;
create policy "Sellers can update their own listings" on public.marketplace_listings
 for update to authenticated using ((select auth.uid()) = seller_id) with check ((select auth.uid()) = seller_id and accepted_responsibility = true);
drop policy if exists "Sellers can delete their own listings" on public.marketplace_listings;
create policy "Sellers can delete their own listings" on public.marketplace_listings
 for delete to authenticated using ((select auth.uid()) = seller_id);

create table if not exists public.marketplace_saved_listings (
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id, listing_id)
);
alter table public.marketplace_saved_listings enable row level security;
revoke all on public.marketplace_saved_listings from anon, authenticated;
grant select, insert, delete on public.marketplace_saved_listings to authenticated;
drop policy if exists "Users manage their saved listings" on public.marketplace_saved_listings;
create policy "Users manage their saved listings" on public.marketplace_saved_listings
 for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.marketplace_messages (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 2000),
 created_at timestamptz not null default now(),
 constraint marketplace_message_not_self check (sender_id <> recipient_id)
);
create index if not exists marketplace_messages_thread_idx on public.marketplace_messages(listing_id, created_at);
alter table public.marketplace_messages enable row level security;
revoke all on public.marketplace_messages from anon, authenticated;
grant select, insert on public.marketplace_messages to authenticated;
drop policy if exists "Participants can read marketplace messages" on public.marketplace_messages;
create policy "Participants can read marketplace messages" on public.marketplace_messages
 for select to authenticated using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);
drop policy if exists "Signed-in users can message listing sellers" on public.marketplace_messages;
create policy "Signed-in users can message listing sellers" on public.marketplace_messages
 for insert to authenticated with check (
   (select auth.uid()) = sender_id and sender_id <> recipient_id and exists (
     select 1 from public.marketplace_listings l where l.id = listing_id and l.seller_id = recipient_id and l.status = 'active'
   )
 );

create table if not exists public.marketplace_listing_reports (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 reason text not null check (char_length(reason) between 3 and 1000),
 created_at timestamptz not null default now(),
 unique(listing_id, reporter_id)
);
alter table public.marketplace_listing_reports enable row level security;
revoke all on public.marketplace_listing_reports from anon, authenticated;
grant insert, select on public.marketplace_listing_reports to authenticated;
drop policy if exists "Users can report listings" on public.marketplace_listing_reports;
create policy "Users can report listings" on public.marketplace_listing_reports for insert to authenticated with check ((select auth.uid()) = reporter_id);
drop policy if exists "Users can view their own reports" on public.marketplace_listing_reports;
create policy "Users can view their own reports" on public.marketplace_listing_reports for select to authenticated using ((select auth.uid()) = reporter_id);

-- Keep existing deployments aligned if this migration is reapplied after an earlier draft.
alter table public.marketplace_listings drop constraint if exists marketplace_listings_condition_check;
alter table public.marketplace_listings add constraint marketplace_listings_condition_check check (condition in ('New','Like new','Good','Fair','For parts','Used'));
