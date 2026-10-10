-- ReconFeed real-user product research survey.
-- Authenticated testers only; no email, birth date, or profile details are copied into responses.
create table if not exists public.reconfeed_research_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  feature_interests text[] not null default '{}',
  monthly_price text not null default 'free',
  identity_mode text not null default 'both',
  biggest_need text not null default '',
  willing_to_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reconfeed_research_features_valid check (
    cardinality(feature_interests) <= 6 and
    feature_interests <@ array['none_yet','avatar_cosmetics','creator_memberships','live_tips_events','ai_creator_tools','creator_marketplace']::text[]
  ),
  constraint reconfeed_research_price_valid check (monthly_price in ('free','2.99','5.99','9.99')),
  constraint reconfeed_research_identity_valid check (identity_mode in ('real','avatar','both')),
  constraint reconfeed_research_need_length check (char_length(biggest_need) <= 500)
);
create index if not exists reconfeed_research_created_at_idx on public.reconfeed_research_responses(created_at desc);
alter table public.reconfeed_research_responses enable row level security;
revoke all on table public.reconfeed_research_responses from public, anon;
grant select, insert, update on table public.reconfeed_research_responses to authenticated;
drop policy if exists "Testers read own research response" on public.reconfeed_research_responses;
create policy "Testers read own research response" on public.reconfeed_research_responses
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Testers insert own research response" on public.reconfeed_research_responses;
create policy "Testers insert own research response" on public.reconfeed_research_responses
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Testers update own research response" on public.reconfeed_research_responses;
create policy "Testers update own research response" on public.reconfeed_research_responses
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
