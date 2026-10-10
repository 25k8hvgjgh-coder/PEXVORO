-- PEXVORO social foundation (Supabase SQL Editor)
-- Run once in the Supabase project connected to this app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, username text unique not null, display_name text not null default 'Creator', bio text not null default '', avatar_url text, birth_date date, gender text check (gender in ('MALE','FEMALE','Other')), created_at timestamptz not null default now());
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists gender text;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_gender_check') THEN ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_check CHECK (gender IN ('MALE','FEMALE','Other')); END IF; END $$;
create table if not exists public.posts (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, caption text not null default '', media_url text not null, media_type text not null check (media_type in ('image','video')), visibility text not null default 'public' check (visibility in ('public','followers','private')), format text not null default 'Original', created_at timestamptz not null default now());
create table if not exists public.likes (post_id uuid not null references public.posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (post_id,user_id));
create table if not exists public.comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, body text not null check (char_length(body) between 1 and 2000), created_at timestamptz not null default now());
create table if not exists public.follows (follower_id uuid not null references auth.users(id) on delete cascade, following_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (follower_id,following_id), check (follower_id <> following_id));
create table if not exists public.saved_posts (user_id uuid not null references auth.users(id) on delete cascade, post_id uuid not null references public.posts(id) on delete cascade, created_at timestamptz not null default now(), primary key (user_id,post_id));
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at asc);

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
declare base_name text; dob date; selected_gender text;
begin
  begin dob := (new.raw_user_meta_data ->> 'date_of_birth')::date;
  exception when others then raise exception 'A valid date of birth is required; PEXVORO is for adults 18 and older.'; end;
  if dob is null or dob > (current_date - interval '18 years')::date or dob < date '1900-01-01' then
    raise exception 'PEXVORO is for adults 18 and older.';
  end if;
  selected_gender := new.raw_user_meta_data ->> 'gender';
  if selected_gender not in ('MALE','FEMALE','Other') then
    raise exception 'Choose MALE, FEMALE, or Other.';
  end if;
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'creator'), '[^a-zA-Z0-9_]', '', 'g'));
  if base_name = '' then base_name := 'creator'; end if;
  insert into public.profiles (id, username, display_name, birth_date, gender)
  values (new.id, base_name || '_' || substr(new.id::text, 1, 6), coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), nullif(split_part(coalesce(new.email,''),'@',1),''), 'Creator'), dob, selected_gender)
  on conflict (id) do nothing;
  return new;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.saved_posts enable row level security;

drop policy if exists "Profiles are readable" on public.profiles;
create policy "Profiles are readable" on public.profiles for select using (true);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public posts are readable" on public.posts;
create policy "Public posts are readable" on public.posts for select using (visibility = 'public' or user_id = (select auth.uid()) or (visibility = 'followers' and exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = posts.user_id)));
drop policy if exists "Users create own posts" on public.posts;
create policy "Users create own posts" on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users update own posts" on public.posts;
create policy "Users update own posts" on public.posts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Users delete own posts" on public.posts;
create policy "Users delete own posts" on public.posts for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Likes are readable" on public.likes;
create policy "Likes are readable" on public.likes for select using (true);
drop policy if exists "Users like posts" on public.likes;
create policy "Users like posts" on public.likes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = likes.post_id and (
      p.visibility = 'public' or p.user_id = (select auth.uid()) or
      (p.visibility = 'followers' and exists (
        select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id
      ))
    )
  )
);
drop policy if exists "Users remove own likes" on public.likes;
create policy "Users remove own likes" on public.likes for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Comments are readable" on public.comments;
create policy "Comments are readable" on public.comments for select using (
  exists (
    select 1 from public.posts p
    where p.id = comments.post_id and (
      p.visibility = 'public' or p.user_id = (select auth.uid()) or
      (p.visibility = 'followers' and exists (
        select 1 from public.follows f
        where f.follower_id = (select auth.uid()) and f.following_id = p.user_id
      ))
    )
  )
);
drop policy if exists "Users create comments" on public.comments;
create policy "Users create comments" on public.comments for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = comments.post_id and (
      p.visibility = 'public' or p.user_id = (select auth.uid()) or
      (p.visibility = 'followers' and exists (
        select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id
      ))
    )
  )
);
drop policy if exists "Users delete own comments" on public.comments;
create policy "Users delete own comments" on public.comments for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Follows are readable" on public.follows;
create policy "Follows are readable" on public.follows for select using (true);
drop policy if exists "Users follow as themselves" on public.follows;
create policy "Users follow as themselves" on public.follows for insert to authenticated with check (follower_id = (select auth.uid()));
drop policy if exists "Users unfollow as themselves" on public.follows;
create policy "Users unfollow as themselves" on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

drop policy if exists "Users read own saves" on public.saved_posts;
create policy "Users read own saves" on public.saved_posts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users save posts" on public.saved_posts;
create policy "Users save posts" on public.saved_posts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users remove own saves" on public.saved_posts;
create policy "Users remove own saves" on public.saved_posts for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('post-media', 'post-media', true, 26214400, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']) on conflict (id) do update set public = true, file_size_limit = 26214400, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Authenticated users upload to own folder" on storage.objects;
create policy "Authenticated users upload to own folder" on storage.objects for insert to authenticated with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Public reads post media" on storage.objects;
create policy "Public reads post media" on storage.objects for select using (bucket_id = 'post-media');
drop policy if exists "Users delete own media" on storage.objects;
create policy "Users delete own media" on storage.objects for delete to authenticated using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Marketplace foundation. Payment state and platform fee are server-controlled;
-- clients can create drafts but cannot mark listings paid or alter financial totals.
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  category text not null default 'Other',
  price_cents integer not null check (price_cents between 1 and 100000000),
  currency text not null default 'usd' check (currency = 'usd'),
  image_urls text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','active','paused','sold','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_listings_active_idx on public.marketplace_listings (created_at desc) where status = 'active';
alter table public.marketplace_listings enable row level security;
drop policy if exists "Active listings readable by everyone" on public.marketplace_listings;
create policy "Active listings readable by everyone" on public.marketplace_listings for select using (status = 'active' or seller_id = (select auth.uid()));
drop policy if exists "Sellers create own drafts" on public.marketplace_listings;
create policy "Sellers create own drafts" on public.marketplace_listings for insert to authenticated with check (seller_id = (select auth.uid()) and status = 'draft');
drop policy if exists "Sellers update own listings" on public.marketplace_listings;
create policy "Sellers update own listings" on public.marketplace_listings for update to authenticated using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()) and status in ('draft','active','paused','removed'));
drop policy if exists "Sellers delete own drafts" on public.marketplace_listings;
create policy "Sellers delete own drafts" on public.marketplace_listings for delete to authenticated using (seller_id = (select auth.uid()) and status = 'draft');

-- Orders are written by trusted server/payment webhooks only; no client write policy.
create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id),
  buyer_id uuid not null references auth.users(id),
  seller_id uuid not null references auth.users(id),
  currency text not null default 'usd' check (currency = 'usd'),
  gross_cents integer not null check (gross_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  seller_amount_cents integer not null check (seller_amount_cents >= 0),
  payment_provider text not null default 'stripe',
  provider_session_id text unique,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','refunded','disputed','cancelled')),
  created_at timestamptz not null default now(),
  check (platform_fee_cents + seller_amount_cents = gross_cents)
);
create index if not exists marketplace_orders_buyer_idx on public.marketplace_orders (buyer_id, created_at desc);
create index if not exists marketplace_orders_seller_idx on public.marketplace_orders (seller_id, created_at desc);
alter table public.marketplace_orders enable row level security;
drop policy if exists "Buyers and sellers read own orders" on public.marketplace_orders;
create policy "Buyers and sellers read own orders" on public.marketplace_orders for select to authenticated using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

-- Restrict client-visible profile columns. Birth date and gender are collected for age/UX checks
-- but must not be available to anonymous users or other authenticated users via PostgREST.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT (birth_date, gender) ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, username, display_name, bio, avatar_url, created_at) ON TABLE public.profiles TO anon, authenticated;
GRANT UPDATE (display_name, bio, avatar_url) ON TABLE public.profiles TO authenticated;
