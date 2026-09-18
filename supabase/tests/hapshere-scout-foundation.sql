-- =============================================================================
-- Local Buzz 757 Scout foundation checks (DISPOSABLE LOCAL STACK ONLY)
-- =============================================================================
\set ON_ERROR_STOP on
set client_min_messages to notice;
begin;

insert into auth.users (
  instance_id, id, aud, role, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000','dddddddd-dddd-dddd-dddd-dddddddddddd',
   'authenticated','authenticated','scout-admin@example.com',now(),now(),'{}','{}',false),
  ('00000000-0000-0000-0000-000000000000','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   'authenticated','authenticated','scout-user@example.com',now(),now(),'{}','{}',false)
on conflict (id) do nothing;

insert into public.admin_users (user_id)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd')
on conflict (user_id) do nothing;

create or replace function pg_temp.assert_true(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_message;
  end if;
  raise notice 'PASS: %', p_message;
end $$;

create or replace function pg_temp.expect_failure(
  p_role text, p_uid text, p_sql text, p_message text
) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin
    execute format('set local role %I', p_role);
    execute 'set local request.jwt.claims = ' || quote_literal(
      json_build_object('sub', p_uid, 'role', p_role)::text);
    execute p_sql;
  exception when others then
    failed := true;
  end;
  execute 'set local role postgres';
  perform pg_temp.assert_true(failed, p_message);
end $$;

-- A future server-side collector uses service_role. No client role can insert.
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

insert into public.listing_candidates (
  id, dedupe_key, place_name, city, listing_type, days, start_time, end_time,
  description, source_url, street_address, zip_code, confidence,
  discovered_at, last_checked_at, expires_at
) values (
  '11111111-1111-1111-1111-111111111111',
  'norfolk:sample-house:tuesday-special',
  'Sample House', 'Norfolk', 'food-special', array['tuesday'],
  '17:00', '21:00', '$10 Tuesday dinner special',
  'https://example.com/specials', '100 Main St', '23510', 0.875,
  now(), now(), now() + interval '30 days'
);

insert into public.listing_candidate_evidence (
  candidate_id, source_url, source_kind, source_title, excerpt, captured_at
) values (
  '11111111-1111-1111-1111-111111111111',
  'https://example.com/specials', 'website', 'Weekly specials',
  'Tuesday dinner special from 5 PM to 9 PM for $10.', now()
);

set local role postgres;

select pg_temp.expect_failure(
  'anon', null,
  'select * from public.listing_candidates',
  'anonymous users cannot read Scout candidates');

do $$
declare visible_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';
  select count(*) into visible_count from public.listing_candidates;
  set local role postgres;
  perform pg_temp.assert_true(visible_count = 0,
    'non-admin users cannot see Scout candidates');
end $$;

select pg_temp.expect_failure(
  'authenticated', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  $q$insert into public.listing_candidates (
    dedupe_key, place_name, city, listing_type, days, description,
    source_url, confidence
  ) values (
    'blocked', 'Blocked', 'Norfolk', 'other', array['monday'], 'blocked',
    'https://example.com', 0.5
  )$q$,
  'authenticated clients cannot insert Scout candidates');

select pg_temp.expect_failure(
  'authenticated', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  $q$select public.publish_listing_candidate(
    '11111111-1111-1111-1111-111111111111', null)$q$,
  'non-admin users cannot publish Scout candidates');

do $$
declare
  visible_count integer;
  listing_id uuid;
  public_count integer;
  candidate_status text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';

  select count(*) into visible_count from public.listing_candidates;
  perform pg_temp.assert_true(visible_count = 1,
    'admins can review Scout candidates');

  select public.publish_listing_candidate(
    '11111111-1111-1111-1111-111111111111',
    'Source and schedule reviewed.'
  ) into listing_id;

  select status into candidate_status
  from public.listing_candidates
  where id = '11111111-1111-1111-1111-111111111111';

  select count(*) into public_count
  from public.get_public_listings(listing_id)
  where place_name = 'Sample House';

  set local role postgres;
  perform pg_temp.assert_true(candidate_status = 'published',
    'publishing marks the candidate as published');
  perform pg_temp.assert_true(public_count = 1,
    'an admin-published candidate appears through the safe public RPC');
end $$;

select pg_temp.expect_failure(
  'authenticated', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  $q$select public.publish_listing_candidate(
    '11111111-1111-1111-1111-111111111111', null)$q$,
  'a Scout candidate cannot be published twice');

rollback;
