-- Fix (audit §6): role `authenticated` had only SELECT on
-- public.contributor_profiles, but the table has INSERT and UPDATE RLS policies.
-- PostgreSQL requires BOTH a table privilege AND a passing policy, so contributor
-- profile creation/upsert was blocked at the database level for the app's roles
-- (the app does not use the service-role key).
--
-- Verified read-only on production 2026-09-04 (has_table_privilege):
--   authenticated -> SELECT=true, INSERT=false, UPDATE=false, DELETE=false.
--
-- Grant the missing privileges. RLS still restricts rows to the caller's own
-- profile and blocks anonymous users (existing policies:
--   "Permanent users can create their profile", "Contributors can update their
--   profile"), so this does not widen row access.

grant insert, update on table public.contributor_profiles to authenticated;
