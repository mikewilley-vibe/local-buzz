# Shared-backend hardening

This change is intentionally limited to the two backend release blockers shared by the web and future Expo applications.

## Public data boundary

Public clients call `public.get_public_listings(p_listing_id uuid default null)`. It returns approved rows only and exposes these fields:

- `id`
- `place_name`
- `city`
- `listing_type`
- `days`
- `start_time`
- `end_time`
- `description`
- HTTP(S) `source_url` values
- `street_address`
- `zip_code`
- `confirmation_count`
- `last_verified_at`

It does not expose `submitted_by`, `is_staff_sourced`, `source_checked_at`, status, creation timestamps, or staff review metadata.

Anonymous users have no privilege on the base `listings` table. Authenticated users can select rows only through the existing own-submission or administrator RLS policies. This lets contributors see their own submissions and administrators moderate every status without exposing another contributor's identity.

Community insertion remains available after anonymous Auth sign-in, which Supabase represents as the `authenticated` database role. Column privileges prevent the caller from supplying status, attribution, counters, verification timestamps, or staff flags. The insert trigger binds `submitted_by` to `auth.uid()`, and the RLS policy verifies that identity.

Confirmations and reports use the approved-listing helper because direct public reads of the base table are no longer permitted.

## Transactional staff import

The admin importer sends one request to `public.import_staff_listings(p_rows jsonb)`. The function:

1. Verifies `auth.uid()` belongs to `admin_users`.
2. Requires a JSON array containing 1–200 rows and no more than 1 MB.
3. Validates every staff-controlled listing field again in PostgreSQL.
4. Hard-codes `pending`, zero confirmations, no submitter, and staff-sourced attribution.
5. Inserts each listing and its optional protected review note.
6. Returns the inserted row count only after the complete batch succeeds.

PostgreSQL executes one RPC call in one transaction. Any exception—including an invalid later row or a staff-metadata failure—rolls back all earlier inserts from that call.

## Required disposable-environment verification

Do not test these migrations against production first. After starting a disposable local Supabase stack:

```bash
npm ci
npx supabase start
npm run db:reset
npm run db:types
npm run lint
npm run build
```

Then verify with development-only identities and synthetic rows:

1. `anon` can execute `get_public_listings` and receives only approved seed rows and only the documented columns.
2. `anon` cannot select or insert directly on `public.listings`.
3. An anonymous Auth session can submit one pending community row through the application.
4. That row's `submitted_by` equals its Auth user ID even if the caller attempts to supply another identity.
5. The caller cannot set approved status, staff attribution, counters, or verification timestamps.
6. A contributor can select their own pending/approved/rejected submissions but cannot select another contributor's base row.
7. A non-administrator cannot execute a staff import.
8. An administrator can import a valid synthetic batch; all rows remain pending and staff-sourced, all submitters are null, and review notes exist only in `listing_staff_metadata`.
9. Attempt a two-row staff batch with a valid first row and invalid second row. Confirm both `listings` and `listing_staff_metadata` counts are unchanged after the error.
10. Confirming and reporting an approved listing still succeeds, while either action against a pending listing fails.
11. Public calendar, listing details, venues, and confirmation-count refresh still load through `get_public_listings`.

Regenerate and commit `src/lib/database.types.ts` only from the successfully rebuilt local database. Do not hand-edit the generated file.

## Production boundary

The migration is captured in source control only. Do not run `db push`, `migration repair`, or linked resets against production until the baseline-history issue is separately reconciled and the disposable-environment checks above pass.
