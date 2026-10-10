-- What an alumnus says they can help with, and how available they are, in their own words. Written only by the alumnus (their own
-- row), shown to UC members on the alumnus's profile page. Nothing here is generated: a profile with no row shows nothing.
create table alumni_offers (
  member_id uuid primary key references profiles(id) on delete cascade,
  help_topics text[] not null default '{}',
  availability text,
  updated_at timestamptz not null default now()
);

alter table alumni_offers enable row level security;
create policy "alumni_offers_select_own" on alumni_offers for select using (member_id = auth.uid());
create policy "alumni_offers_insert_own" on alumni_offers for insert with check (member_id = auth.uid());
create policy "alumni_offers_update_own" on alumni_offers for update using (member_id = auth.uid()) with check (member_id = auth.uid());
grant select, insert, update on alumni_offers to authenticated;

-- Members read the offer on a profile page by the person's email (the directory row's address). The table itself stays own-row
-- only, so this one narrow function is the whole of what other members can see: topics and availability, nothing else about the account.
create function alumni_offer_for_email(p_email text)
returns table (help_topics text[], availability text)
language sql
stable
security definer
set search_path = public
as $$
  select o.help_topics, o.availability
  from alumni_offers o
  join auth.users u on u.id = o.member_id
  join profiles p on p.id = o.member_id
  where lower(u.email::text) = lower(trim(p_email))
    and p.member_status = 'alumni'
    and p.deactivated_at is null
    and (cardinality(o.help_topics) > 0 or o.availability is not null);
$$;
revoke all on function alumni_offer_for_email(text) from public, anon;
grant execute on function alumni_offer_for_email(text) to authenticated;
