-- PEXVORO social foundation (Supabase SQL Editor)
-- Run once in the Supabase project connected to this app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, username text unique not null, display_name text not null default 'Creator', bio text not null default '', avatar_url text, created_at timestamptz not null default now());
create table if not exists public.posts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, caption text not null default '', media_url text not null, media_type text not null check (media_type in ('image','video')), visibility text not null default 'public' check (visibility in ('public','followers','private')), format text not null default 'Original', created_at timestamptz not null default now());
create table if not exists public.likes (post_id uuid not null references public.posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (post_id,user_id));
create table if not exists public.comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, body text not null check (char_length(body) between 1 and 2000), created_at timestamptz not null default now());
create table if not exists public.follows (follower_id uuid not null references auth.users(id) on delete cascade, following_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (follower_id,following_id), check (follower_id <> following_id));
create table if not exists public.saved_posts (user_id uuid not null references auth.users(id) on delete cascade, post_id uuid not null references public.posts(id) on delete cascade, created_at timestamptz not null default now(), primary key (user_id,post_id));
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at asc);

create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path = '' as $$ declare base_name text; begin base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'creator'), '[^a-zA-Z0-9_]', '', 'g')); if base_name = '' then base_name := 'creator'; end if; insert into public.profiles (id, username, display_name) values (new.id, base_name || '_' || substr(new.id::text, 1, 6), coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), nullif(split_part(coalesce(new.email,''),'@',1),''), 'Creator')) on conflict (id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
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
create policy "Users like posts" on public.likes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users remove own likes" on public.likes;
create policy "Users remove own likes" on public.likes for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Comments are readable" on public.comments;
create policy "Comments are readable" on public.comments for select using (exists (select 1 from public.posts p where p.id = comments.post_id and (p.visibility = 'public' or p.user_id = (select auth.uid()) or (p.visibility = 'followers' and exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.user_id))));
drop policy if exists "Users create comments" on public.comments;
create policy "Users create comments" on public.comments for insert to authenticated with check (user_id = (select auth.uid()));
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
