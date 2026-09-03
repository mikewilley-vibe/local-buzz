-- =============================================================================
-- Local Buzz — baseline schema
-- =============================================================================
-- Provenance: captured read-only from the live Supabase project
--   (project ref: vghnfdukyosvvoqrxmok) on 2026-09-03. This file represents the
--   COMPLETE current-state contract (schemas, tables, constraints, indexes,
--   functions, triggers, grants, and RLS policies).
--
-- It supersedes and folds in the three earlier incremental migrations
--   (listings_select_own_submissions, staff_sourced_listings,
--    listing_staff_metadata), which have been removed so this baseline is the
--   single auditable source of truth for a fresh development project.
--
-- No production objects were modified to produce this file.
--
-- SECURITY NOTES (captured as-is; do NOT change here — tracked as follow-ups):
--   * P0 #3/#4: `public.listings` grants ALL privileges to `anon` and
--     `authenticated`. RLS is currently the only gate. See the grants section.
--   * P0 #4: the "Anyone can submit pending listings" policy targets role
--     `public` (not `authenticated`) and does not require a non-null submitter.
-- These are reproduced faithfully so the repo matches production; tightening is
-- proposed as a separate migration/PR.
-- =============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Schemas --------------------------------------------------------------------
-- `private` holds trigger functions so they are never exposed via PostgREST.
create schema if not exists private;

-- =============================================================================
-- Tables
-- =============================================================================

-- listings -------------------------------------------------------------------
create table if not exists public.listings (
  id                 uuid        not null default gen_random_uuid(),
  place_name         text        not null,
  city               text        not null,
  listing_type       text        not null,
  days               text[]      not null,
  start_time         time,
  end_time           time,
  description        text        not null,
  source_url         text,
  status             text        not null default 'pending'::text,
  confirmation_count integer     not null default 0,
  submitted_at       timestamptz not null default now(),
  last_verified_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  street_address     text,
  zip_code           text,
  submitted_by       uuid,
  source_checked_at  timestamptz,
  is_staff_sourced   boolean     not null default false,
  constraint listings_pkey primary key (id),
  constraint listings_submitted_by_fkey foreign key (submitted_by)
    references auth.users (id) on delete set null,
  constraint listings_city_check check (city = any (array[
    'Norfolk'::text, 'Virginia Beach'::text, 'Chesapeake'::text,
    'Portsmouth'::text, 'Hampton'::text, 'Newport News'::text,
    'Suffolk'::text, 'Williamsburg'::text])),
  constraint listings_listing_type_check check (listing_type = any (array[
    'happy-hour'::text, 'food-special'::text, 'trivia'::text,
    'music-bingo'::text, 'live-music'::text, 'other'::text])),
  constraint listings_status_check check (status = any (array[
    'pending'::text, 'approved'::text, 'rejected'::text, 'outdated'::text])),
  constraint listings_days_check check (
    (cardinality(days) > 0)
    and (days <@ array['monday'::text, 'tuesday'::text, 'wednesday'::text,
      'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text])),
  constraint listings_confirmation_count_check check (confirmation_count >= 0),
  constraint listings_street_address_length check (
    (street_address is null) or (char_length(street_address) <= 200)),
  constraint listings_zip_code_format check (
    (zip_code is null) or (zip_code ~ '^[0-9]{5}(-[0-9]{4})?$'::text))
);

-- listing_confirmations ------------------------------------------------------
create table if not exists public.listing_confirmations (
  id         uuid        not null default gen_random_uuid(),
  listing_id uuid        not null,
  user_id    uuid        not null,
  created_at timestamptz not null default now(),
  constraint listing_confirmations_pkey primary key (id),
  constraint listing_confirmations_listing_id_user_id_key unique (listing_id, user_id),
  constraint listing_confirmations_listing_id_fkey foreign key (listing_id)
    references public.listings (id) on delete cascade,
  constraint listing_confirmations_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade
);

-- listing_reports ------------------------------------------------------------
create table if not exists public.listing_reports (
  id         uuid        not null default gen_random_uuid(),
  listing_id uuid        not null,
  user_id    uuid        not null,
  reason     text        not null,
  note       text,
  status     text        not null default 'pending'::text,
  created_at timestamptz not null default now(),
  constraint listing_reports_pkey primary key (id),
  constraint listing_reports_listing_id_user_id_key unique (listing_id, user_id),
  constraint listing_reports_listing_id_fkey foreign key (listing_id)
    references public.listings (id) on delete cascade,
  constraint listing_reports_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade,
  constraint listing_reports_reason_check check (reason = any (array[
    'deal_ended'::text, 'wrong_schedule'::text, 'wrong_details'::text,
    'venue_closed'::text, 'other'::text])),
  constraint listing_reports_status_check check (status = any (array[
    'pending'::text, 'resolved'::text, 'dismissed'::text])),
  constraint listing_reports_note_check check (char_length(note) <= 500)
);

-- admin_users ----------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid        not null,
  created_at timestamptz not null default now(),
  constraint admin_users_pkey primary key (user_id),
  constraint admin_users_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade
);

-- contributor_profiles -------------------------------------------------------
create table if not exists public.contributor_profiles (
  user_id      uuid        not null,
  display_name text        not null,
  created_at   timestamptz not null default now(),
  constraint contributor_profiles_pkey primary key (user_id),
  constraint contributor_profiles_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade,
  constraint contributor_profiles_display_name_check check (
    (char_length(trim(both from display_name)) >= 2)
    and (char_length(trim(both from display_name)) <= 30))
);

-- point_events ---------------------------------------------------------------
create table if not exists public.point_events (
  id              uuid        not null default gen_random_uuid(),
  user_id         uuid        not null,
  listing_id      uuid,
  confirmation_id uuid,
  event_type      text        not null,
  points          integer     not null,
  source_key      text        not null,
  created_at      timestamptz not null default now(),
  constraint point_events_pkey primary key (id),
  constraint point_events_source_key_key unique (source_key),
  constraint point_events_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade,
  constraint point_events_listing_id_fkey foreign key (listing_id)
    references public.listings (id) on delete cascade,
  constraint point_events_confirmation_id_fkey foreign key (confirmation_id)
    references public.listing_confirmations (id) on delete cascade,
  constraint point_events_event_type_check check (event_type = any (array[
    'listing_approved'::text, 'listing_confirmed'::text])),
  constraint point_events_points_check check (points > 0)
);

-- listing_staff_metadata -----------------------------------------------------
-- Internal staff review notes kept off `listings` so approved-row SELECT cannot
-- leak them through PostgREST. Admin-only (see RLS below).
create table if not exists public.listing_staff_metadata (
  listing_id uuid        not null,
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint listing_staff_metadata_pkey primary key (listing_id),
  constraint listing_staff_metadata_listing_id_fkey foreign key (listing_id)
    references public.listings (id) on delete cascade
);

-- =============================================================================
-- Indexes (covering indexes beyond the implicit PK/UNIQUE indexes)
-- =============================================================================
create index if not exists listings_submitted_by_idx on public.listings (submitted_by);
create index if not exists listings_zip_code_idx      on public.listings (zip_code);

-- =============================================================================
-- Trigger functions (private schema; all SET search_path = '')
-- =============================================================================

create or replace function private.set_listing_submitter()
  returns trigger
  language plpgsql
  set search_path to ''
as $function$
begin
  if coalesce(new.is_staff_sourced, false) then
    new.submitted_by := null;
  else
    new.submitted_by := (select auth.uid());
  end if;

  return new;
end;
$function$;

create or replace function private.update_listing_confirmation()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $function$
begin
  update public.listings
  set
    confirmation_count = confirmation_count + 1,
    last_verified_at = now(),
    updated_at = now()
  where id = new.listing_id
    and status = 'approved';

  return new;
end;
$function$;

create or replace function private.award_listing_approval_points()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $function$
begin
  if new.status = 'approved'
     and old.status is distinct from 'approved'
     and new.submitted_by is not null
     and coalesce(new.is_staff_sourced, false) = false then

    insert into public.point_events (
      user_id,
      listing_id,
      confirmation_id,
      event_type,
      points,
      source_key
    )
    values (
      new.submitted_by,
      new.id,
      null,
      'listing_approved',
      5,
      'listing-approved:' || new.id::text
    )
    on conflict (source_key) do nothing;
  end if;

  return new;
end;
$function$;

create or replace function private.award_listing_confirmation_points()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $function$
declare
  contributor_id uuid;
  staff_sourced boolean;
begin
  select submitted_by, is_staff_sourced
  into contributor_id, staff_sourced
  from public.listings
  where id = new.listing_id;

  if contributor_id is not null
     and coalesce(staff_sourced, false) = false
     and contributor_id <> new.user_id then

    insert into public.point_events (
      user_id,
      listing_id,
      confirmation_id,
      event_type,
      points,
      source_key
    )
    values (
      contributor_id,
      new.listing_id,
      new.id,
      'listing_confirmed',
      1,
      'confirmation:' || new.id::text
    )
    on conflict (source_key) do nothing;
  end if;

  return new;
end;
$function$;

-- =============================================================================
-- Triggers
-- =============================================================================
drop trigger if exists set_listing_submitter on public.listings;
create trigger set_listing_submitter
  before insert on public.listings
  for each row execute function private.set_listing_submitter();

drop trigger if exists award_listing_approval_points on public.listings;
create trigger award_listing_approval_points
  after update of status on public.listings
  for each row execute function private.award_listing_approval_points();

drop trigger if exists award_listing_confirmation_points on public.listing_confirmations;
create trigger award_listing_confirmation_points
  after insert on public.listing_confirmations
  for each row execute function private.award_listing_confirmation_points();

drop trigger if exists update_listing_after_confirmation on public.listing_confirmations;
create trigger update_listing_after_confirmation
  after insert on public.listing_confirmations
  for each row execute function private.update_listing_confirmation();

-- =============================================================================
-- Grants
-- =============================================================================
-- RLS (below) is the primary access gate; these table privileges are captured
-- exactly as they exist in production. `revoke` first so a fresh project's
-- default privileges cannot widen the surface unexpectedly.
grant usage on schema public to anon, authenticated, service_role;

-- listings: FIXME (P0 #3/#4) — production grants ALL to anon + authenticated.
-- Reproduced as-is; tightening to (select, insert) is proposed separately.
revoke all on table public.listings from anon, authenticated;
grant all on table public.listings to anon, authenticated;

revoke all on table public.listing_confirmations from anon, authenticated;
grant select, insert on table public.listing_confirmations to authenticated;

revoke all on table public.listing_reports from anon, authenticated;
grant select, insert, update on table public.listing_reports to authenticated;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

revoke all on table public.contributor_profiles from anon, authenticated;
grant select on table public.contributor_profiles to authenticated;

revoke all on table public.point_events from anon, authenticated;
grant select on table public.point_events to authenticated;

revoke all on table public.listing_staff_metadata from anon, authenticated;
grant select, insert, update, delete on table public.listing_staff_metadata to authenticated;

-- service_role retains full access (Supabase default / server-side only).
grant all on all tables in schema public to service_role;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.listings               enable row level security;
alter table public.listing_confirmations  enable row level security;
alter table public.listing_reports        enable row level security;
alter table public.admin_users            enable row level security;
alter table public.contributor_profiles   enable row level security;
alter table public.point_events           enable row level security;
alter table public.listing_staff_metadata enable row level security;

-- listings policies ----------------------------------------------------------
create policy "Anyone can read approved listings"
  on public.listings for select
  to anon, authenticated
  using (status = 'approved'::text);

create policy "listings_select_own_submissions"
  on public.listings for select
  to authenticated
  using (submitted_by = (select auth.uid()));

create policy "Admins can view every listing"
  on public.listings for select
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

create policy "Admins can update listings"
  on public.listings for update
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

-- FIXME (P0 #4): targets role `public` and does not require a non-null
-- submitter. Reproduced as-is; scoping to `authenticated` is proposed separately.
create policy "Anyone can submit pending listings"
  on public.listings for insert
  to public
  with check (
    (status = 'pending'::text)
    and (confirmation_count = 0)
    and (last_verified_at is null)
    and (is_staff_sourced = false));

create policy "Admins can insert staff listings"
  on public.listings for insert
  to authenticated
  with check (
    (exists (
      select 1 from public.admin_users
      where admin_users.user_id = (select auth.uid())))
    and (status = 'pending'::text)
    and (confirmation_count = 0)
    and (last_verified_at is null)
    and (is_staff_sourced = true)
    and (submitted_by is null));

-- listing_confirmations policies ---------------------------------------------
create policy "Visitors can confirm approved listings"
  on public.listing_confirmations for insert
  to authenticated
  with check (
    ((select auth.uid()) = user_id)
    and exists (
      select 1 from public.listings
      where listings.id = listing_confirmations.listing_id
        and listings.status = 'approved'::text));

create policy "Visitors can see their confirmations"
  on public.listing_confirmations for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- listing_reports policies ---------------------------------------------------
create policy "Visitors can report approved listings"
  on public.listing_reports for insert
  to authenticated
  with check (
    ((select auth.uid()) = user_id)
    and (status = 'pending'::text)
    and exists (
      select 1 from public.listings
      where listings.id = listing_reports.listing_id
        and listings.status = 'approved'::text));

create policy "Visitors can view their own reports"
  on public.listing_reports for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Admins can view every report"
  on public.listing_reports for select
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

create policy "Admins can update reports"
  on public.listing_reports for update
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

-- admin_users policies -------------------------------------------------------
create policy "Admins can verify their own access"
  on public.admin_users for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- contributor_profiles policies ----------------------------------------------
create policy "Contributors can view their profile"
  on public.contributor_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Permanent users can create their profile"
  on public.contributor_profiles for insert
  to authenticated
  with check (
    ((select auth.uid()) = user_id)
    and (coalesce(((select (auth.jwt() ->> 'is_anonymous'::text)))::boolean, false) = false));

create policy "Contributors can update their profile"
  on public.contributor_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    ((select auth.uid()) = user_id)
    and (coalesce(((select (auth.jwt() ->> 'is_anonymous'::text)))::boolean, false) = false));

-- point_events policies ------------------------------------------------------
-- No INSERT policy: rows are written only by the SECURITY DEFINER triggers
-- above, which prevents clients from awarding themselves points.
create policy "Contributors can view their points"
  on public.point_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- listing_staff_metadata policies (admin-only) -------------------------------
create policy "Admins can select listing staff metadata"
  on public.listing_staff_metadata for select
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

create policy "Admins can insert listing staff metadata"
  on public.listing_staff_metadata for insert
  to authenticated
  with check (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

create policy "Admins can update listing staff metadata"
  on public.listing_staff_metadata for update
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

create policy "Admins can delete listing staff metadata"
  on public.listing_staff_metadata for delete
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));
