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

## Production release record (2026-09-04)

This section is a historical record of the release that put the hardening contract
into production. The migrations themselves are immutable applied records and must
not be split, renamed, or edited after the fact.

### 1. The cutover that occurred

- `20260904010000_harden_public_api_and_staff_import` and
  `20260904120000_contributor_profiles_grant` were merged into `main` and applied
  to the production project with `supabase db push`.
- The push was immediately preceded by a one-time migration-history
  reconciliation (`supabase migration repair --status applied 20260902000000`)
  so the additive baseline was recorded as already-applied without re-running it.
  Remote history now contains the baseline, the three `20260903*` incrementals,
  and both `20260904*` migrations.
- The production web frontend was cut over to the new RPC-based build in the same
  window (a Vercel production promotion) so the deployed code and the database
  contract matched.

### 2. Production uses `get_public_listings`

The live public calendar, listing detail pages, and venue pages read approved
listings exclusively through `public.get_public_listings`. Post-cutover
verification confirmed the homepage renders the full approved set and detail
pages load through the RPC.

### 3. Anonymous base-table access is removed

The `anon` role has no privilege on `public.listings` in production. Public
reads are only possible through `get_public_listings`, which returns approved
rows and the documented columns only.

### 4. Transactional staff imports are live

The admin importer runs against `public.import_staff_listings` in production.
Each call executes in a single transaction, so an invalid row rolls back the
entire batch, including any staff-metadata writes.

### 5. Rollback protection used during deployment

Because the merge auto-deployed the new frontend slightly ahead of the database
migration, the previous known-good production deployment was kept available and
used for an instant rollback to keep the public site serving during the gap.
The coordinated sequence was: restore the site via rollback, reconcile history,
apply the migrations, then promote the new frontend and verify. At every point a
prior production deployment remained available as an instant-rollback target.

## Future release rule: expand and contract migrations

`20260904010000` combined *expand* changes (new RPCs and permissions the new code
needs) with *contract* changes (removing the old anonymous base-table access) in a
single migration. Applying it required a brief, rollback-protected coordination
window because the old and new frontends needed opposite database states.

For any future change that requires coordinated code and database deployment, do
not combine expand and contract in one migration. Split them into two migrations
that reach production separately:

1. **Expand migration** — additive only (new functions, columns, permissions,
   compatible policies). Apply it while the current application remains live; it
   must not break the running app.
2. **Deploy the application** that depends on the expanded surface, then
   smoke-test it against the expanded database.
3. **Contract migration** — remove the now-unused old access (drop legacy
   policies, revoke privileges, tighten grants) only after the new application is
   fully deployed and verified.

This ordering removes the need for a coordination window and lets each step be
rolled back independently.

## Production boundary (historical)

Before the release recorded above, this contract lived in source control only and
carried the instruction to avoid `db push`, `migration repair`, and linked resets
until the baseline-history issue was reconciled and the disposable-environment
checks passed. That reconciliation has since been completed and the migrations
applied, as described in the release record. Future migrations follow the normal
branch → disposable-stack CI → merge → `db push` flow, and the immutable applied
migrations above must not be rewritten.
