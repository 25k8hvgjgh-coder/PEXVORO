-- Reposts reference existing posts; they never duplicate media or bypass post visibility.
create table if not exists public.reposts (
 user_id uuid not null references public.profiles(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id, post_id)
);
create index if not exists reposts_user_created_idx on public.reposts(user_id, created_at desc);
create index if not exists reposts_post_idx on public.reposts(post_id);
alter table public.reposts enable row level security;
revoke all on public.reposts from anon, authenticated;
grant select on public.reposts to anon, authenticated;
grant insert(user_id,post_id),delete on public.reposts to authenticated;
create policy "Visible reposts respect both profiles" on public.reposts for select using (
 (user_id=(select auth.uid()) or public.reconfeed_posts_can_view(user_id,'public'))
 and exists(select 1 from public.posts p where p.id=post_id and p.visibility='public')
);
create policy "Users repost visible public posts" on public.reposts for insert to authenticated with check (
 user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id and p.visibility='public')
);
create policy "Users remove own reposts" on public.reposts for delete to authenticated using(user_id=(select auth.uid()));
