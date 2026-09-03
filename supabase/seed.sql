-- =============================================================================
-- Local Buzz — development seed data
-- =============================================================================
-- Applied by `supabase db reset` after the migrations, for LOCAL/DEV only.
--
-- SAFETY: This is synthetic sample data. NEVER copy production user data or
-- real contributor identities here. There are intentionally no auth.users,
-- no admin_users, no point_events, and no submitter identities.
--
-- Notes:
--   * These rows are inserted directly (bypassing RLS as the superuser), so we
--     can set status = 'approved' for a browsable dev calendar.
--   * The `set_listing_submitter` BEFORE INSERT trigger sets submitted_by = NULL
--     for these (non-staff, no auth.uid() in a seed context).
-- =============================================================================

insert into public.listings
  (place_name, city, listing_type, days, start_time, end_time, description, status, street_address, zip_code)
values
  ('Sample Taproom', 'Norfolk', 'happy-hour',
    array['monday','tuesday','wednesday','thursday','friday']::text[],
    '16:00', '19:00',
    '$5 drafts and half-price appetizers. Sample dev listing.',
    'approved', '100 Sample St', '23510'),
  ('Sample Pizza Co', 'Virginia Beach', 'trivia',
    array['tuesday']::text[],
    '19:00', '21:00',
    'Weekly trivia night, teams of up to six. Sample dev listing.',
    'approved', '200 Example Ave', '23451'),
  ('Sample Brewing', 'Chesapeake', 'live-music',
    array['friday','saturday']::text[],
    '20:00', '23:00',
    'Local bands every weekend. Sample dev listing.',
    'approved', '300 Demo Blvd', '23320'),
  ('Sample Grill', 'Newport News', 'food-special',
    array['wednesday']::text[],
    '17:00', '21:00',
    'Half-price wings all night. Sample dev listing.',
    'approved', '400 Placeholder Rd', '23601');

-- To exercise admin flows locally:
--   1. Create a dev user via Studio (http://127.0.0.1:54323) or the auth API.
--   2. Insert their id here, e.g.:
--        insert into public.admin_users (user_id) values ('<dev-user-uuid>');
--      (Left commented out because admin_users.user_id has an FK to auth.users.)
