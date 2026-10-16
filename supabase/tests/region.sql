-- Region checks (DISPOSABLE LOCAL STACK ONLY).
-- Run after migrations. Never run this against a hosted project.
\set ON_ERROR_STOP on
set client_min_messages to notice;

insert into auth.users (
  instance_id, id, aud, role, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'dev-admin@example.com', now(), now(),
  '{}', '{}', false
) on conflict (id) do nothing;

insert into public.admin_users (user_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
on conflict (user_id) do nothing;

do $$
declare
  v_region text;
  v_rva_id uuid;
  v_listed int;
  v_by_id int;
  v_hidden int;
  v_imported int;
  v_import_region text;
  v_failed boolean := false;
begin
  if exists (
    select 1 from public.listings
    where city <> 'Richmond' and region is distinct from '757'
  ) or exists (
    select 1 from public.listing_candidates
    where city <> 'Richmond' and region is distinct from '757'
  ) then
    raise notice 'CHECK 1 : FAIL (existing non-Richmond rows were not backfilled to 757)';
    v_failed := true;
  else
    raise notice 'CHECK 1 : PASS (existing rows are region 757)';
  end if;

  insert into public.listings (
    place_name, city, listing_type, days, description, status
  ) values (
    'Region Norfolk', 'Norfolk', 'other', array['monday'], 'norfolk', 'approved'
  ) returning region into v_region;

  if v_region = '757' then
    raise notice 'CHECK 2 : PASS (Norfolk insert stamped 757)';
  else
    raise notice 'CHECK 2 : FAIL (Norfolk region %)', v_region;
    v_failed := true;
  end if;

  insert into public.listings (
    place_name, city, listing_type, days, description, status, region
  ) values (
    'Region Richmond', 'Richmond', 'trivia', array['tuesday'], 'richmond', 'approved', '757'
  ) returning id, region into v_rva_id, v_region;

  if v_region = 'rva' then
    raise notice 'CHECK 3 : PASS (Richmond insert stamped rva over a forced 757)';
  else
    raise notice 'CHECK 3 : FAIL (Richmond region %)', v_region;
    v_failed := true;
  end if;

  begin
    insert into public.listings (
      place_name, city, listing_type, days, description, status
    ) values (
      'Region Atlantis', 'Atlantis', 'other', array['monday'], 'nope', 'approved'
    );
    raise notice 'CHECK 4 : FAIL (unsupported city was accepted)';
    v_failed := true;
  exception when check_violation then
    raise notice 'CHECK 4 : PASS (unsupported city rejected)';
  end;

  insert into public.listing_candidates (
    dedupe_key, place_name, city, listing_type, days, description, source_url, confidence
  ) values (
    'region-test-richmond', 'Richmond Hall', 'Richmond', 'trivia', array['friday'],
    'Trivia night', 'https://example.com/region-test', 0.9
  ) returning region into v_region;

  if v_region = 'rva' then
    raise notice 'CHECK 5 : PASS (Scout candidate stamped rva)';
  else
    raise notice 'CHECK 5 : FAIL (candidate region %)', v_region;
    v_failed := true;
  end if;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into v_listed
    from public.get_public_listings(null, 'rva')
    where id = v_rva_id;
  select count(*) into v_hidden
    from public.get_public_listings(null, '757')
    where id = v_rva_id;
  select count(*) into v_by_id
    from public.get_public_listings(v_rva_id, '757')
    where id = v_rva_id;
  perform set_config('role', 'postgres', true);

  if v_listed = 1 and v_hidden = 0 and v_by_id = 1 then
    raise notice 'CHECK 6 : PASS (region filter hides RVA from 757; by-id still opens it)';
  else
    raise notice 'CHECK 6 : FAIL (rva list %, 757 list %, by-id %)', v_listed, v_hidden, v_by_id;
    v_failed := true;
  end if;

  if exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'region'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'INSERT'
  ) then
    raise notice 'CHECK 7 : FAIL (community roles can insert region)';
    v_failed := true;
  else
    raise notice 'CHECK 7 : PASS (region is not community-insertable)';
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',
    true
  );
  select public.import_staff_listings($json$[
    {
      "place_name": "RVA Import",
      "city": "Richmond",
      "listing_type": "trivia",
      "days": ["friday"],
      "description": "Trivia night",
      "source_url": "https://example.com/rva-import",
      "zip_code": "23220",
      "street_address": "1 W Main St",
      "source_checked_at": "2026-10-01T00:00:00Z"
    }
  ]$json$::jsonb) into v_imported;
  perform set_config('role', 'postgres', true);

  select region into v_import_region
  from public.listings
  where place_name = 'RVA Import';

  if v_imported = 1 and v_import_region = 'rva' then
    raise notice 'CHECK 8 : PASS (staff import accepts Richmond and stamps rva)';
  else
    raise notice 'CHECK 8 : FAIL (imported %, region %)', v_imported, v_import_region;
    v_failed := true;
  end if;

  if v_failed then
    raise exception 'One or more region checks failed';
  end if;
end $$;
