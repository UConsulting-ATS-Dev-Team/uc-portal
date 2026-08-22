-- Real member preferences (Stage 2), mirroring data/store.jsx's
-- `preferences` object field-for-field so the sync layer in store.jsx can
-- read/write it without any translation layer. This is what lets
-- data/jobMatch.js eventually run server-side (an Edge Function) instead of
-- only client-side against localStorage -- Part 3.9's stated design.
-- One row per member, RLS-restricted to that member's own row only (same
-- pattern as profiles) -- career preferences are personal, never visible to
-- another member, and only readable in aggregate (already-mocked
-- data/mockAdmin.js) by admins, never as raw per-member rows.

create table member_preferences (
  id uuid primary key references auth.users(id) on delete cascade,
  industries text[] not null default '{}',
  roles text[] not null default '{}',
  locations text[] not null default '{}',
  open_to_relocating boolean not null default false,
  remote_or_hybrid_only boolean not null default false,
  followed_companies text[] not null default '{}',
  recruiting_cycle text,
  help_needed text[] not null default '{}',
  reminders_enabled boolean not null default true,
  resume_attached boolean not null default false,
  opportunity_type text not null default 'Internship',
  comp_target numeric,
  recruiting_settings jsonb not null default '{
    "showOutsideTargetLocations": true,
    "letAlumniSeeRecruiting": true,
    "prioritizeUcConnections": true,
    "openToCoffeeChatRequests": false,
    "shareOutcomesAnonymized": true,
    "includeInExecReporting": true
  }'::jsonb,
  updated_at timestamptz not null default now()
);

alter table member_preferences enable row level security;
create policy "member_preferences_select_own" on member_preferences for select using (id = auth.uid());
create policy "member_preferences_insert_own" on member_preferences for insert with check (id = auth.uid());
create policy "member_preferences_update_own" on member_preferences for update using (id = auth.uid());

grant select, insert, update on public.member_preferences to authenticated;
