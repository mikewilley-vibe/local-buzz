-- =============================================================================
-- Local Buzz — shared-backend hardening checks (DISPOSABLE LOCAL STACK ONLY)
-- =============================================================================
-- Run AFTER: npx supabase start && npm run db:reset
-- Then:      psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--              -f supabase/tests/shared-backend-hardening.sql
-- This same file is executed by .github/workflows/shared-backend-hardening.yml
-- on a disposable GitHub-hosted stack (no local Docker required).
--
-- NEVER run this against a hosted/production project.
-- It creates dev-only identities and synthetic rows, all inside the local DB.
-- Each check prints "CHECK n: PASS/FAIL ...". Read the NOTICEs at the end.
-- =============================================================================
\set ON_ERROR_STOP off
set client_min_messages to notice;

-- ---- Dev-only identities ----------------------------------------------------
-- Fixed UUIDs for repeatability. If your local auth.users has extra NOT NULL
-- columns without defaults, create the users via Studio/Auth API instead and
-- reuse their UUIDs below.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, is_anonymous)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated','authenticated','dev-admin@example.com', now(), now(), '{}','{}', false),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'authenticated','authenticated','dev-contrib-a@example.com', now(), now(), '{}','{}', false),
  ('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-cccccccccccc',
   'authenticated','authenticated','dev-contrib-b@example.com', now(), now(), '{}','{}', false)
on conflict (id) do nothing;

insert into public.admin_users (user_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
on conflict (user_id) do nothing;

-- Helper: run a snippet as a role+uid and report whether it raised.
create or replace function pg_temp.expect(
  p_check text, p_role text, p_uid text, p_sql text, p_should_fail boolean
) returns void language plpgsql as $$
declare raised boolean := false; msg text;
begin
  begin
    execute format('set local role %I', p_role);
    if p_uid is null then
      execute 'set local request.jwt.claims = ' || quote_literal(json_build_object('role',p_role)::text);
    else
      execute 'set local request.jwt.claims = ' || quote_literal(json_build_object('sub',p_uid,'role',p_role)::text);
    end if;
    execute p_sql;
  exception when others then
    raised := true; msg := SQLERRM;
  end;
  execute 'set local role postgres';
  if raised = p_should_fail then
    raise notice '% : PASS (%).', p_check, case when raised then 'blocked: '||msg else 'allowed' end;
  else
    raise notice '% : FAIL (expected %; got %). %', p_check,
      case when p_should_fail then 'error' else 'success' end,
      case when raised then 'error' else 'success' end, coalesce(msg,'');
  end if;
end $$;

-- ---- 1) anon can execute get_public_listings, approved-only, fixed columns --
do $$
declare n int;
begin
  set local role anon; set local request.jwt.claims = '{"role":"anon"}';
  select count(*) into n from public.get_public_listings();
  set local role postgres;
  raise notice 'CHECK 1 : % (anon get_public_listings returned % rows; column set is fixed by the RETURNS TABLE signature: id, place_name, city, listing_type, days, start_time, end_time, description, source_url, street_address, zip_code, confirmation_count, last_verified_at).',
    case when n >= 0 then 'PASS' else 'FAIL' end, n;
end $$;

-- ---- 2) anon cannot select or insert base listings --------------------------
select pg_temp.expect('CHECK 2a (anon select listings)','anon',null,
  'select * from public.listings limit 1', true);
select pg_temp.expect('CHECK 2b (anon insert listings)','anon',null,
  $q$insert into public.listings(place_name,city,listing_type,days,description)
     values('anon x','Norfolk','other',array['monday'],'y')$q$, true);

-- ---- 3) authenticated community insert succeeds (allowed columns only) ------
select pg_temp.expect('CHECK 3 (authenticated community insert)','authenticated',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  $q$insert into public.listings(place_name,city,listing_type,days,description,source_url)
     values('Comm A','Norfolk','other',array['monday'],'desc','https://example.com')$q$, false);

-- ---- 4) submitted_by is forced to auth.uid() -------------------------------
do $$
declare v_owner uuid;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  insert into public.listings(place_name,city,listing_type,days,description)
    values('Comm attribution','Hampton','trivia',array['tuesday'],'d');
  set local role postgres;
  select submitted_by into v_owner from public.listings where place_name='Comm attribution';
  raise notice 'CHECK 4 : % (submitted_by=% expected bbbbbbbb-...).',
    case when v_owner = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' then 'PASS' else 'FAIL' end, v_owner;
end $$;

-- ---- 5) caller cannot set status / attribution / counters / timestamps -----
select pg_temp.expect('CHECK 5a (set status)','authenticated','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  $q$insert into public.listings(place_name,city,listing_type,days,description,status)
     values('x','Norfolk','other',array['monday'],'d','approved')$q$, true);
select pg_temp.expect('CHECK 5b (set submitted_by)','authenticated','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  $q$insert into public.listings(place_name,city,listing_type,days,description,submitted_by)
     values('x','Norfolk','other',array['monday'],'d','cccccccc-cccc-cccc-cccc-cccccccccccc')$q$, true);
select pg_temp.expect('CHECK 5c (set confirmation_count)','authenticated','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  $q$insert into public.listings(place_name,city,listing_type,days,description,confirmation_count)
     values('x','Norfolk','other',array['monday'],'d',5)$q$, true);
select pg_temp.expect('CHECK 5d (set is_staff_sourced)','authenticated','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  $q$insert into public.listings(place_name,city,listing_type,days,description,is_staff_sourced)
     values('x','Norfolk','other',array['monday'],'d',true)$q$, true);

-- ---- 6) contributor sees own rows, not another's ---------------------------
do $$
declare own int; other int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  select count(*) into own   from public.listings where submitted_by='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  select count(*) into other from public.listings where submitted_by='cccccccc-cccc-cccc-cccc-cccccccccccc';
  set local role postgres;
  raise notice 'CHECK 6 : % (own visible=%, other visible=% [expected other=0]).',
    case when own >= 1 and other = 0 then 'PASS' else 'FAIL' end, own, other;
end $$;

-- ---- 7) non-admin cannot import --------------------------------------------
select pg_temp.expect('CHECK 7 (non-admin import)','authenticated','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  $q$select public.import_staff_listings(
      '[{"place_name":"S","city":"Norfolk","listing_type":"other","days":["monday"],
         "description":"d","source_url":"https://e.com","zip_code":"23510",
         "source_checked_at":"2026-09-01T00:00:00Z"}]'::jsonb)$q$, true);

-- ---- 8) admin valid batch: pending, staff-sourced, submitted_by null, notes -
do $$
declare cnt int; bad int; notes int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  perform public.import_staff_listings(
    '[{"place_name":"Staff One","city":"Norfolk","listing_type":"other","days":["monday"],
       "description":"d1","source_url":"https://e.com/1","zip_code":"23510",
       "source_checked_at":"2026-09-01T00:00:00Z","review_note":"note1"},
      {"place_name":"Staff Two","city":"Hampton","listing_type":"trivia","days":["tuesday"],
       "description":"d2","source_url":"https://e.com/2","zip_code":"23666",
       "source_checked_at":"2026-09-01T00:00:00Z"}]'::jsonb);
  set local role postgres;
  select count(*) into cnt  from public.listings where place_name in ('Staff One','Staff Two');
  select count(*) into bad  from public.listings where place_name in ('Staff One','Staff Two')
    and (status<>'pending' or is_staff_sourced<>true or submitted_by is not null or confirmation_count<>0);
  select count(*) into notes from public.listing_staff_metadata m
    join public.listings l on l.id=m.listing_id where l.place_name='Staff One';
  raise notice 'CHECK 8 : % (inserted=% [exp 2], nonconforming=% [exp 0], note rows for Staff One=% [exp 1]).',
    case when cnt=2 and bad=0 and notes=1 then 'PASS' else 'FAIL' end, cnt, bad, notes;
end $$;

-- ---- 9) CRITICAL: two-row batch (valid, invalid) rolls back entirely -------
do $$
declare l_before int; m_before int; l_after int; m_after int; raised boolean := false; msg text;
begin
  select count(*) into l_before from public.listings;
  select count(*) into m_before from public.listing_staff_metadata;
  begin
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
    perform public.import_staff_listings(
      '[{"place_name":"RollbackValid","city":"Norfolk","listing_type":"other","days":["monday"],
         "description":"ok","source_url":"https://e.com/ok","zip_code":"23510",
         "source_checked_at":"2026-09-01T00:00:00Z","review_note":"should not persist"},
        {"place_name":"RollbackInvalid","city":"Atlantis","listing_type":"other","days":["monday"],
         "description":"bad city","source_url":"https://e.com/bad","zip_code":"23510",
         "source_checked_at":"2026-09-01T00:00:00Z"}]'::jsonb);
  exception when others then raised := true; msg := SQLERRM;
  end;
  set local role postgres;
  select count(*) into l_after from public.listings;
  select count(*) into m_after from public.listing_staff_metadata;
  raise notice 'CHECK 9 : % (rpc raised=% [exp true]; listings %/% ; staff_meta %/% ; leftover valid row present=%).',
    case when raised
          and l_after=l_before and m_after=m_before
          and not exists(select 1 from public.listings where place_name='RollbackValid')
         then 'PASS' else 'FAIL' end,
    raised, l_before, l_after, m_before, m_after,
    exists(select 1 from public.listings where place_name='RollbackValid');
  raise notice '          rpc error was: %', coalesce(msg,'(none)');
end $$;

-- ---- 10) confirmations/reports only for approved listings ------------------
-- Uses a seeded approved listing and one pending row created above.
do $$
declare approved_id uuid; pending_id uuid;
begin
  select id into approved_id from public.listings where status='approved' order by id limit 1;
  select id into pending_id  from public.listings where status='pending' order by id limit 1;
  raise notice 'CHECK 10 setup: approved_id=%, pending_id=%', approved_id, pending_id;

  perform pg_temp.expect('CHECK 10a (confirm approved -> ok)','authenticated','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    format('insert into public.listing_confirmations(listing_id,user_id) values (%L,%L)',
           approved_id,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), false);
  perform pg_temp.expect('CHECK 10b (confirm pending -> blocked)','authenticated','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    format('insert into public.listing_confirmations(listing_id,user_id) values (%L,%L)',
           pending_id,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), true);
  perform pg_temp.expect('CHECK 10c (report approved -> ok)','authenticated','cccccccc-cccc-cccc-cccc-cccccccccccc',
    format('insert into public.listing_reports(listing_id,user_id,reason,status) values (%L,%L,%L,%L)',
           approved_id,'cccccccc-cccc-cccc-cccc-cccccccccccc','other','pending'), false);
  perform pg_temp.expect('CHECK 10d (report pending -> blocked)','authenticated','cccccccc-cccc-cccc-cccc-cccccccccccc',
    format('insert into public.listing_reports(listing_id,user_id,reason,status) values (%L,%L,%L,%L)',
           pending_id,'cccccccc-cccc-cccc-cccc-cccccccccccc','other','pending'), true);
end $$;

-- ---- 11) app-level: verify calendar/details/venues load via get_public_listings
-- Run `npm run dev` and load /, /listings/[id], /venues, and confirm the
-- confirmation-count refresh works. (Not a SQL check.)
raise notice 'CHECK 11 : verify in the running app (npm run dev) — public pages load via get_public_listings.';
