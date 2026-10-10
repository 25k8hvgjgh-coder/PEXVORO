-- Keep the original profiles embed working for installed clients.
-- auth.users is outside the public PostgREST schema, avoiding a second posts-to-profiles relationship.
alter table public.reposts drop constraint reposts_user_id_fkey;
alter table public.reposts add constraint reposts_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
