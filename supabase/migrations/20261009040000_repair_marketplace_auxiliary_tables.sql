-- ReconFeed marketplace repair migration
-- Idempotently creates the three auxiliary marketplace tables if the first
-- marketplace migration was only partially executed. Safe to re-run.

create table if not exists public.marketplace_saved_listings (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table public.marketplace_saved_listings enable row level security;
revoke all on public.marketplace_saved_listings from anon, authenticated;
grant select, insert, delete on public.marketplace_saved_listings to authenticated;
drop policy if exists "Users manage their saved listings" on public.marketplace_saved_listings;
create policy "Users manage their saved listings" on public.marketplace_saved_listings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint marketplace_message_not_self check (sender_id <> recipient_id)
);

create index if not exists marketplace_messages_thread_idx
  on public.marketplace_messages(listing_id, created_at);
alter table public.marketplace_messages enable row level security;
revoke all on public.marketplace_messages from anon, authenticated;
grant select, insert on public.marketplace_messages to authenticated;
drop policy if exists "Participants can read marketplace messages" on public.marketplace_messages;
create policy "Participants can read marketplace messages" on public.marketplace_messages
  for select to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);
drop policy if exists "Signed-in users can message listing sellers" on public.marketplace_messages;
create policy "Signed-in users can message listing sellers" on public.marketplace_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_id <> recipient_id
    and exists (
      select 1 from public.marketplace_listings l
      where l.id = listing_id
        and l.seller_id = recipient_id
        and l.status = 'active'
    )
  );

create table if not exists public.marketplace_listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) between 3 and 1000),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

alter table public.marketplace_listing_reports enable row level security;
revoke all on public.marketplace_listing_reports from anon, authenticated;
grant insert, select on public.marketplace_listing_reports to authenticated;
drop policy if exists "Users can report listings" on public.marketplace_listing_reports;
create policy "Users can report listings" on public.marketplace_listing_reports
  for insert to authenticated
  with check ((select auth.uid()) = reporter_id);
drop policy if exists "Users can view their own reports" on public.marketplace_listing_reports;
create policy "Users can view their own reports" on public.marketplace_listing_reports
  for select to authenticated
  using ((select auth.uid()) = reporter_id);
