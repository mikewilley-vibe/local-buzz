-- Region for Hampton Roads (757) and Richmond (rva).
-- Existing rows are Hampton Roads and are backfilled to 757.
-- A before-write trigger stamps region from city, so clients cannot choose it
-- and region stays off the community INSERT column grant.
-- Approved for production local-buzz (vghnfdukyosvvoqrxmok) and local-buzz-dev.

alter table public.listings drop constraint listings_city_check;
alter table public.listings add constraint listings_city_check check (city = any (array[
  'Norfolk'::text, 'Virginia Beach'::text, 'Chesapeake'::text,
  'Portsmouth'::text, 'Hampton'::text, 'Newport News'::text,
  'Suffolk'::text, 'Williamsburg'::text, 'Richmond'::text
]));

alter table public.listing_candidates drop constraint listing_candidates_city_check;
alter table public.listing_candidates add constraint listing_candidates_city_check check (
  city = any (array[
    'Norfolk'::text, 'Virginia Beach'::text, 'Chesapeake'::text,
    'Portsmouth'::text, 'Hampton'::text, 'Newport News'::text,
    'Suffolk'::text, 'Williamsburg'::text, 'Richmond'::text
  ])
);

alter table public.listings
  add column region text not null default '757';

alter table public.listing_candidates
  add column region text not null default '757';

update public.listings
set region = '757'
where region is distinct from '757';

update public.listing_candidates
set region = '757'
where region is distinct from '757';

alter table public.listings
  add constraint listings_region_check check (region = any (array[
    '757'::text, 'rva'::text
  ]));

alter table public.listings
  add constraint listings_region_city_check check (
    (region = '757' and city = any (array[
      'Norfolk'::text, 'Virginia Beach'::text, 'Chesapeake'::text,
      'Portsmouth'::text, 'Hampton'::text, 'Newport News'::text,
      'Suffolk'::text, 'Williamsburg'::text
    ]))
    or (region = 'rva' and city = 'Richmond')
  );

alter table public.listing_candidates
  add constraint listing_candidates_region_check check (region = any (array[
    '757'::text, 'rva'::text
  ]));

alter table public.listing_candidates
  add constraint listing_candidates_region_city_check check (
    (region = '757' and city = any (array[
      'Norfolk'::text, 'Virginia Beach'::text, 'Chesapeake'::text,
      'Portsmouth'::text, 'Hampton'::text, 'Newport News'::text,
      'Suffolk'::text, 'Williamsburg'::text
    ]))
    or (region = 'rva' and city = 'Richmond')
  );

create index listings_region_idx on public.listings (region);
create index listing_candidates_region_idx on public.listing_candidates (region);

create or replace function private.set_listing_region()
  returns trigger
  language plpgsql
  set search_path to ''
as $function$
begin
  if new.city in (
    'Norfolk', 'Virginia Beach', 'Chesapeake', 'Portsmouth', 'Hampton',
    'Newport News', 'Suffolk', 'Williamsburg'
  ) then
    new.region := '757';
  elsif new.city = 'Richmond' then
    new.region := 'rva';
  end if;

  return new;
end;
$function$;

drop trigger if exists set_listing_region on public.listings;
create trigger set_listing_region
  before insert or update of city, region on public.listings
  for each row execute function private.set_listing_region();

drop trigger if exists set_listing_candidate_region on public.listing_candidates;
create trigger set_listing_candidate_region
  before insert or update of city, region on public.listing_candidates
  for each row execute function private.set_listing_region();

-- Return shape changes, so replace the function instead of overloading it.
drop function if exists public.get_public_listings(uuid);

create function public.get_public_listings(
  p_listing_id uuid default null,
  p_region text default null
)
returns table (
  id uuid,
  place_name text,
  city text,
  listing_type text,
  days text[],
  start_time time,
  end_time time,
  description text,
  source_url text,
  street_address text,
  zip_code text,
  confirmation_count integer,
  last_verified_at timestamptz,
  region text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    listings.id,
    listings.place_name,
    listings.city,
    listings.listing_type,
    listings.days,
    listings.start_time,
    listings.end_time,
    listings.description,
    case
      when listings.source_url ~* '^https?://' then listings.source_url
      else null
    end as source_url,
    listings.street_address,
    listings.zip_code,
    listings.confirmation_count,
    listings.last_verified_at,
    listings.region
  from public.listings
  where listings.status = 'approved'
    and (p_listing_id is null or listings.id = p_listing_id)
    and (
      p_listing_id is not null
      or p_region is null
      or (
        p_region = any (array['757'::text, 'rva'::text])
        and listings.region = p_region
      )
    )
  order by listings.start_time asc nulls last, listings.id;
$function$;

revoke all on function public.get_public_listings(uuid, text) from public;
grant execute on function public.get_public_listings(uuid, text) to anon, authenticated;

create or replace function public.import_staff_listings(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  imported_count integer := 0;
  row_number integer := 0;
  import_row jsonb;
  v_listing_id uuid;
  v_place_name text;
  v_city text;
  v_listing_type text;
  v_listing_days text[];
  v_start_time_text text;
  v_end_time_text text;
  v_description text;
  v_source_url text;
  v_source_checked_at timestamptz;
  v_street_address text;
  v_zip_code text;
  v_review_note text;
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Staff import payload must be a JSON array.' using errcode = '22023';
  end if;

  if octet_length(p_rows::text) > 1048576 then
    raise exception 'Staff import payload exceeds 1 MB.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 200 then
    raise exception 'Staff import must contain between 1 and 200 rows.'
      using errcode = '22023';
  end if;

  for import_row in
    select value from jsonb_array_elements(p_rows)
  loop
    row_number := row_number + 1;

    if jsonb_typeof(import_row) <> 'object' then
      raise exception 'Staff import row % must be an object.', row_number
        using errcode = '22023';
    end if;

    v_place_name := nullif(btrim(import_row ->> 'place_name'), '');
    v_city := nullif(btrim(import_row ->> 'city'), '');
    v_listing_type := nullif(btrim(import_row ->> 'listing_type'), '');
    v_description := nullif(btrim(import_row ->> 'description'), '');
    v_source_url := nullif(btrim(import_row ->> 'source_url'), '');
    v_street_address := nullif(btrim(import_row ->> 'street_address'), '');
    v_zip_code := nullif(btrim(import_row ->> 'zip_code'), '');
    v_review_note := nullif(btrim(import_row ->> 'review_note'), '');
    v_start_time_text := nullif(btrim(import_row ->> 'start_time'), '');
    v_end_time_text := nullif(btrim(import_row ->> 'end_time'), '');

    if v_place_name is null or char_length(v_place_name) > 200 then
      raise exception 'Staff import row % has an invalid place name.', row_number
        using errcode = '22023';
    end if;

    if v_city is null or v_city <> all (array[
      'Norfolk', 'Virginia Beach', 'Chesapeake', 'Portsmouth', 'Hampton',
      'Newport News', 'Suffolk', 'Williamsburg', 'Richmond'
    ]) then
      raise exception 'Staff import row % has an unsupported city.', row_number
        using errcode = '22023';
    end if;

    if v_listing_type is null or v_listing_type <> all (array[
      'happy-hour', 'food-special', 'trivia', 'music-bingo', 'live-music', 'other'
    ]) then
      raise exception 'Staff import row % has an unsupported listing type.', row_number
        using errcode = '22023';
    end if;

    if jsonb_typeof(import_row -> 'days') <> 'array' then
      raise exception 'Staff import row % must contain a days array.', row_number
        using errcode = '22023';
    end if;

    select coalesce(array_agg(day_value), array[]::text[])
    into v_listing_days
    from jsonb_array_elements_text(import_row -> 'days') as days(day_value);

    if cardinality(v_listing_days) < 1
       or cardinality(v_listing_days) > 7
       or not (v_listing_days <@ array[
         'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
         'sunday'
       ]::text[])
       or cardinality(v_listing_days) <> cardinality(array(
         select distinct day_value
         from unnest(v_listing_days) as distinct_days(day_value)
       )) then
      raise exception 'Staff import row % has invalid or duplicate days.', row_number
        using errcode = '22023';
    end if;

    if v_start_time_text is not null
       and v_start_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
      raise exception 'Staff import row % has an invalid start time.', row_number
        using errcode = '22023';
    end if;

    if v_end_time_text is not null
       and v_end_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
      raise exception 'Staff import row % has an invalid end time.', row_number
        using errcode = '22023';
    end if;

    if v_description is null or char_length(v_description) > 2000 then
      raise exception 'Staff import row % has an invalid description.', row_number
        using errcode = '22023';
    end if;

    if v_source_url is null
       or char_length(v_source_url) > 2000
       or v_source_url !~* '^https?://' then
      raise exception 'Staff import row % has an invalid source URL.', row_number
        using errcode = '22023';
    end if;

    if v_street_address is not null and char_length(v_street_address) > 200 then
      raise exception 'Staff import row % has an invalid street address.', row_number
        using errcode = '22023';
    end if;

    if v_zip_code is null or v_zip_code !~ '^[0-9]{5}(-[0-9]{4})?$' then
      raise exception 'Staff import row % has an invalid ZIP code.', row_number
        using errcode = '22023';
    end if;

    if nullif(btrim(import_row ->> 'source_checked_at'), '') is null then
      raise exception 'Staff import row % requires a source checked date.', row_number
        using errcode = '22023';
    end if;

    if v_review_note is not null and char_length(v_review_note) > 1000 then
      raise exception 'Staff import row % has an invalid review note.', row_number
        using errcode = '22023';
    end if;

    begin
      v_source_checked_at := (import_row ->> 'source_checked_at')::timestamptz;
    exception when others then
      raise exception 'Staff import row % has an invalid source checked date.', row_number
        using errcode = '22023';
    end;

    insert into public.listings (
      place_name,
      city,
      listing_type,
      days,
      start_time,
      end_time,
      description,
      source_url,
      status,
      confirmation_count,
      last_verified_at,
      street_address,
      zip_code,
      submitted_by,
      source_checked_at,
      is_staff_sourced
    ) values (
      v_place_name,
      v_city,
      v_listing_type,
      v_listing_days,
      v_start_time_text::time,
      v_end_time_text::time,
      v_description,
      v_source_url,
      'pending',
      0,
      null,
      v_street_address,
      v_zip_code,
      null,
      v_source_checked_at,
      true
    ) returning id into v_listing_id;

    if v_review_note is not null then
      insert into public.listing_staff_metadata (listing_id, review_note)
      values (v_listing_id, v_review_note);
    end if;

    imported_count := imported_count + 1;
  end loop;

  return imported_count;
end;
$function$;
