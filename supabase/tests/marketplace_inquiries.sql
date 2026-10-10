-- Run only AFTER the reviewed seller-reply migration is authorized and applied.
-- No policy changes and no fixture data persists after ROLLBACK.
begin;
create temporary table reconfeed_probe_users (kind text primary key, id uuid not null default gen_random_uuid()) on commit drop;
insert into reconfeed_probe_users(kind) values ('seller'), ('buyer'), ('outsider');
grant select on reconfeed_probe_users to authenticated;
insert into auth.users (id,email,raw_user_meta_data)
select id, id::text || '@reconfeed-probe.invalid', '{"date_of_birth":"1990-01-01","gender":"Other","display_name":"Isolated ReconFeed probe"}'::jsonb from reconfeed_probe_users;
create temporary table reconfeed_probe_listing (id uuid) on commit drop;
with listing as (
  insert into public.marketplace_listings (seller_id,title,description,price,category,condition,accepted_responsibility,seller_shipping_terms,status)
  select id,'Isolated inquiry policy probe','Rolled back immediately',12.50,'Other','Used',true,'No transaction or shipping. Test fixture.','draft' from reconfeed_probe_users where kind='seller'
  returning id
) insert into reconfeed_probe_listing select id from listing;
update public.marketplace_listings set status='active' where id in (select id from reconfeed_probe_listing);
grant select on reconfeed_probe_listing to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',(select id from reconfeed_probe_users where kind='buyer'),'role','authenticated')::text,true);
insert into public.marketplace_messages (listing_id,sender_id,recipient_id,body)
select l.id,b.id,s.id,'Isolated buyer inquiry; will be rolled back.' from reconfeed_probe_listing l,reconfeed_probe_users b,reconfeed_probe_users s where b.kind='buyer' and s.kind='seller';
do $$ begin
  if (select count(*) from public.marketplace_messages where listing_id in (select id from reconfeed_probe_listing)) <> 1 then raise exception 'Buyer cannot read own inquiry'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',(select id from reconfeed_probe_users where kind='seller'),'role','authenticated')::text,true);
do $$ begin
  if (select count(*) from public.marketplace_messages where listing_id in (select id from reconfeed_probe_listing)) <> 1 then raise exception 'Seller cannot read received inquiry'; end if;
  insert into public.marketplace_messages(listing_id,sender_id,recipient_id,body)
  select l.id,s.id,b.id,'Seller probe reply' from reconfeed_probe_listing l,reconfeed_probe_users s,reconfeed_probe_users b where s.kind='seller' and b.kind='buyer';
  if (select count(*) from public.marketplace_messages where listing_id in (select id from reconfeed_probe_listing)) <> 2 then raise exception 'Seller reply was not saved'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',(select id from reconfeed_probe_users where kind='buyer'),'role','authenticated')::text,true);
do $$ begin
  if (select count(*) from public.marketplace_messages where listing_id in (select id from reconfeed_probe_listing)) <> 2 then raise exception 'Buyer cannot read seller reply'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',(select id from reconfeed_probe_users where kind='outsider'),'role','authenticated')::text,true);
do $$ begin
  if (select count(*) from public.marketplace_messages where listing_id in (select id from reconfeed_probe_listing)) <> 0 then raise exception 'Outsider can read a private conversation'; end if;
  begin
    insert into public.marketplace_messages(listing_id,sender_id,recipient_id,body)
    select l.id,b.id,s.id,'Forged sender probe' from reconfeed_probe_listing l,reconfeed_probe_users b,reconfeed_probe_users s where b.kind='buyer' and s.kind='seller';
    raise exception 'Forged sender was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.marketplace_messages(listing_id,sender_id,recipient_id,body)
    select l.id,o.id,b.id,'Buyer-to-buyer probe' from reconfeed_probe_listing l,reconfeed_probe_users o,reconfeed_probe_users b where o.kind='outsider' and b.kind='buyer';
    raise exception 'Buyer-to-buyer message was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
