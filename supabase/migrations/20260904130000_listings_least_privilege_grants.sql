-- Hardening (audit §9.2): tighten public.listings table grants to least
-- privilege. Production currently grants ALL to both `anon` and `authenticated`.
--
-- This changes ONLY table privileges, not RLS policies, and is behavior-
-- preserving because RLS already gates every operation:
--   * There is no DELETE policy on listings, so client DELETE/TRUNCATE were
--     already denied regardless of the grant.
--   * UPDATE is allowed only by the "Admins can update listings" policy
--     (admins are `authenticated`), so authenticated retains UPDATE; anon does
--     not (no anon UPDATE policy).
--   * SELECT/INSERT remain for the roles that have matching policies.
--
-- Preserved:
--   authenticated -> SELECT, INSERT, UPDATE
--   anon          -> SELECT, INSERT
-- Removed (unused: no policy relies on them):
--   DELETE, TRUNCATE, REFERENCES, TRIGGER for anon and authenticated.

revoke all on table public.listings from anon, authenticated;
grant select, insert, update on table public.listings to authenticated;
grant select, insert on table public.listings to anon;

-- NOTE: This does NOT address the remaining §9 items, which require design and
-- (in some cases) application changes and are intentionally left as separate
-- follow-ups:
--   §9.1  Public contributor UUID exposure: anon can still SELECT every column
--         of approved rows, including submitted_by. Proper fix = a safe public
--         view / RPC (column projection) + app change. Not a grant change.
--   §9.3/§9.4  "Anyone can submit pending listings" targets role PUBLIC and does
--         not require a non-null submitter; scoping it to `authenticated` with a
--         submitter check is a policy/behavior change needing app testing.
--   §9.5  source_url has no protocol constraint; adding a CHECK requires
--         validating existing rows first (use NOT VALID + a later VALIDATE).
