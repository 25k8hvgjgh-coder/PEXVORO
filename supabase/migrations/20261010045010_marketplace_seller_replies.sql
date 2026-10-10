-- Permit the listing owner to reply; keep buyer-to-buyer messages forbidden.
-- Existing SELECT policy still restricts every row to its sender and recipient.
drop policy if exists "Signed-in users can message listing sellers" on public.marketplace_messages;
create policy "Listing buyers and sellers can send messages"
  on public.marketplace_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_id <> recipient_id
    and exists (
      select 1 from public.marketplace_listings l
      where l.id = marketplace_messages.listing_id
        and (
          (l.seller_id = recipient_id and l.status = 'active')
          or l.seller_id = sender_id
        )
    )
  );
