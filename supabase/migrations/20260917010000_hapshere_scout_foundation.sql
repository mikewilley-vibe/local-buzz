-- Local Buzz 757 Scout foundation.
-- Historical filename and applied SQL retain hapshere_scout identifiers.
--
-- This migration creates a private-by-default staging boundary for specials
-- discovered from public web sources. Candidates never appear in the public
-- listings RPC until an administrator explicitly publishes one. Automated
-- discovery/crawling is intentionally not included in this migration.

create table public.listing_candidates (
  id                    uuid        not null default gen_random_uuid(),
  dedupe_key            text        not null,
  place_name            text        not null,
  city                  text        not null,
  listing_type          text        not null,
  days                  text[]      not null,
  start_time            time,
  end_time              time,
  description           text        not null,
  source_url            text        not null,
  street_address        text,
  zip_code              text,
  confidence            numeric(4,3) not null,
  status                text        not null default 'pending_review',
  discovered_at         timestamptz not null default now(),
  last_checked_at       timestamptz not null default now(),
  expires_at            timestamptz not null default (now() + interval '30 days'),
  reviewed_at           timestamptz,
  reviewed_by           uuid,
  published_listing_id  uuid,
  rejection_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint listing_candidates_pkey primary key (id),
  constraint listing_candidates_dedupe_key_key unique (dedupe_key),
  constraint listing_candidates_reviewed_by_fkey foreign key (reviewed_by)
    references auth.users (id) on delete set null,
  constraint listing_candidates_published_listing_id_fkey
    foreign key (published_listing_id)
    references public.listings (id),
  constraint listing_candidates_published_listing_id_key
    unique (published_listing_id),
  constraint listing_candidates_dedupe_key_check check (
    char_length(btrim(dedupe_key)) between 1 and 200),
  constraint listing_candidates_place_name_check check (
    char_length(btrim(place_name)) between 1 and 200),
  constraint listing_candidates_city_check check (city = any (array[
    'Norfolk'::text, 'Virginia Beach'::text, 'Chesapeake'::text,
    'Portsmouth'::text, 'Hampton'::text, 'Newport News'::text,
    'Suffolk'::text, 'Williamsburg'::text])),
  constraint listing_candidates_listing_type_check check (listing_type = any (array[
    'happy-hour'::text, 'food-special'::text, 'trivia'::text,
    'music-bingo'::text, 'live-music'::text, 'other'::text])),
  constraint listing_candidates_days_check check (
    cardinality(days) between 1 and 7
    and days <@ array[
      'monday'::text, 'tuesday'::text, 'wednesday'::text,
      'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text]),
  constraint listing_candidates_description_check check (
    char_length(btrim(description)) between 1 and 2000),
  constraint listing_candidates_source_url_check check (
    char_length(source_url) <= 2000 and source_url ~* '^https?://'),
  constraint listing_candidates_street_address_check check (
    street_address is null or char_length(street_address) <= 200),
  constraint listing_candidates_zip_code_check check (
    zip_code is null or zip_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  constraint listing_candidates_confidence_check check (
    confidence >= 0 and confidence <= 1),
  constraint listing_candidates_status_check check (status = any (array[
    'pending_review'::text, 'published'::text, 'rejected'::text,
    'stale'::text])),
  constraint listing_candidates_expiration_check check (
    expires_at > discovered_at),
  constraint listing_candidates_rejection_reason_check check (
    rejection_reason is null or char_length(rejection_reason) <= 500),
  constraint listing_candidates_review_state_check check (
    (status = 'pending_review' and reviewed_at is null
      and reviewed_by is null and published_listing_id is null
      and rejection_reason is null)
    or (status = 'published' and reviewed_at is not null
      and published_listing_id is not null
      and rejection_reason is null)
    or (status = 'rejected' and reviewed_at is not null
      and published_listing_id is null
      and rejection_reason is not null)
    or (status = 'stale' and published_listing_id is null))
);

create table public.listing_candidate_evidence (
  id           uuid        not null default gen_random_uuid(),
  candidate_id uuid        not null,
  source_url   text        not null,
  source_kind  text        not null,
  source_title text,
  excerpt      text        not null,
  captured_at  timestamptz not null,
  created_at   timestamptz not null default now(),
  constraint listing_candidate_evidence_pkey primary key (id),
  constraint listing_candidate_evidence_candidate_id_fkey
    foreign key (candidate_id)
    references public.listing_candidates (id) on delete cascade,
  constraint listing_candidate_evidence_candidate_url_key
    unique (candidate_id, source_url),
  constraint listing_candidate_evidence_source_url_check check (
    char_length(source_url) <= 2000 and source_url ~* '^https?://'),
  constraint listing_candidate_evidence_source_kind_check check (
    source_kind = any (array[
      'website'::text, 'menu'::text, 'social'::text,
      'event_calendar'::text, 'other'::text])),
  constraint listing_candidate_evidence_source_title_check check (
    source_title is null or char_length(source_title) <= 300),
  constraint listing_candidate_evidence_excerpt_check check (
    char_length(btrim(excerpt)) between 1 and 4000)
);

create index listing_candidates_review_queue_idx
  on public.listing_candidates (status, expires_at, confidence desc);
create index listing_candidate_evidence_candidate_idx
  on public.listing_candidate_evidence (candidate_id);

create or replace function private.touch_listing_candidate_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger touch_listing_candidate_updated_at
  before update on public.listing_candidates
  for each row execute function private.touch_listing_candidate_updated_at();

alter table public.listing_candidates enable row level security;
alter table public.listing_candidate_evidence enable row level security;

revoke all on table public.listing_candidates from anon, authenticated;
revoke all on table public.listing_candidate_evidence from anon, authenticated;
grant select on table public.listing_candidates to authenticated;
grant select on table public.listing_candidate_evidence to authenticated;
grant all on table public.listing_candidates to service_role;
grant all on table public.listing_candidate_evidence to service_role;

create policy "Admins can view listing candidates"
  on public.listing_candidates for select
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

create policy "Admins can view listing candidate evidence"
  on public.listing_candidate_evidence for select
  to authenticated
  using (exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())));

create or replace function public.publish_listing_candidate(
  p_candidate_id uuid,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  candidate public.listing_candidates%rowtype;
  new_listing_id uuid;
  clean_note text := nullif(btrim(p_review_note), '');
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  select * into candidate
  from public.listing_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Listing candidate was not found.' using errcode = 'P0002';
  end if;

  if candidate.status <> 'pending_review' then
    raise exception 'Only pending candidates can be published.' using errcode = '22023';
  end if;

  if candidate.expires_at <= now() or candidate.last_checked_at < now() - interval '30 days' then
    raise exception 'Listing candidate evidence is stale.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.listing_candidate_evidence
    where candidate_id = candidate.id
      and captured_at >= candidate.discovered_at - interval '1 day'
  ) then
    raise exception 'Listing candidate requires current source evidence.' using errcode = '22023';
  end if;

  if clean_note is not null and char_length(clean_note) > 900 then
    raise exception 'Review note must be 900 characters or fewer.' using errcode = '22023';
  end if;

  insert into public.listings (
    place_name, city, listing_type, days, start_time, end_time, description,
    source_url, status, confirmation_count, last_verified_at, street_address,
    zip_code, submitted_by, source_checked_at, is_staff_sourced
  ) values (
    candidate.place_name, candidate.city, candidate.listing_type,
    candidate.days, candidate.start_time, candidate.end_time,
    candidate.description, candidate.source_url, 'approved', 0, null,
    candidate.street_address, candidate.zip_code, null,
    candidate.last_checked_at, true
  ) returning id into new_listing_id;

  insert into public.listing_staff_metadata (listing_id, review_note)
  values (
    new_listing_id,
    left(
      'HapsHere Scout candidate ' || candidate.id::text
      || case when clean_note is null then '' else '. ' || clean_note end,
      1000
    )
  );

  update public.listing_candidates
  set status = 'published',
      reviewed_at = now(),
      reviewed_by = (select auth.uid()),
      published_listing_id = new_listing_id
  where id = candidate.id;

  return new_listing_id;
end;
$function$;

create or replace function public.reject_listing_candidate(
  p_candidate_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  clean_reason text := nullif(btrim(p_reason), '');
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users
    where admin_users.user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if clean_reason is null or char_length(clean_reason) > 500 then
    raise exception 'A rejection reason of 500 characters or fewer is required.'
      using errcode = '22023';
  end if;

  update public.listing_candidates
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = (select auth.uid()),
      rejection_reason = clean_reason
  where id = p_candidate_id
    and status = 'pending_review';

  if not found then
    raise exception 'Pending listing candidate was not found.' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.publish_listing_candidate(uuid, text) from public;
revoke all on function public.reject_listing_candidate(uuid, text) from public;
grant execute on function public.publish_listing_candidate(uuid, text) to authenticated;
grant execute on function public.reject_listing_candidate(uuid, text) to authenticated;
