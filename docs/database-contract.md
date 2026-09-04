# Local Buzz — database contract

This document is the source-of-truth guide for the Local Buzz Supabase database
contract that lives in `supabase/`. It explains what the schema contains, how to
regenerate artifacts, the migration ordering, the local/remote migration-history
situation, and the known follow-ups that must be handled as separate, approved
changes.

Production project: `local-buzz` (`vghnfdukyosvvoqrxmok`).
Point-in-time catalog evidence: `docs/database-contract-evidence-20260904.md`.

> Nothing in this repo should be applied to a hosted project without an explicit,
> separately approved step. The files here are for building **fresh
> local/development** databases.

---

## 1. Schema inventory

- **Schemas:** `public` (application), `private` (trigger functions, not exposed
  via PostgREST). Extensions `pgcrypto` and `uuid-ossp` live in `extensions`.
- **Tables (7):** `listings`, `listing_confirmations`, `listing_reports`,
  `admin_users`, `contributor_profiles`, `point_events`, `listing_staff_metadata`.
  RLS is enabled on all seven.
- **Enums:** none. Business value sets (cities, listing types, statuses, days,
  report reasons/statuses, point event types) are `text` + CHECK constraints.
- **Constraints:** 34 named — 7 primary keys, 3 unique, foreign keys to
  `auth.users` and between application tables, and the CHECKs above.
- **Indexes:** 12 — 10 backing PK/UNIQUE plus `listings_submitted_by_idx` and
  `listings_zip_code_idx`.
- **Functions (`private`, owner `postgres`):** `set_listing_submitter` (INVOKER),
  `update_listing_confirmation`, `award_listing_approval_points`,
  `award_listing_confirmation_points` (all three SECURITY DEFINER,
  `search_path = ''`).
- **Triggers (4):** submitter attribution before insert on `listings`; approval
  points after status update on `listings`; confirmation points and the
  confirmation-count/verified-at update after insert on `listing_confirmations`.
- **RLS policies:** 21 (see the evidence report for the full list).
- **Points model:** +5 to a non-staff contributor on first approval; +1 to the
  contributor when a *different* user confirms a non-staff listing; self- and
  staff-sourced awards excluded; idempotent via `point_events.source_key`.
  `point_events` has no client INSERT policy — only the DEFINER triggers write it.

Full detail (column types, defaults, constraint definitions, policy predicates,
grants) is in `docs/database-contract-evidence-20260904.md`.

## 2. Regeneration instructions

All commands target a **local** stack; none touch production.

Prerequisites: Docker running, and the pinned Supabase CLI (installed as a
devDependency — run via `npx supabase ...` or the npm scripts).

```bash
# 1. Start a disposable local Supabase stack
npx supabase start

# 2. Rebuild the database from source (baseline + the three incrementals + seed)
npm run db:reset          # => supabase db reset

# 3. Regenerate TypeScript types from the LOCAL database
npm run db:types          # => supabase gen types typescript --local --schema public > src/lib/database.types.ts
```

This exact rebuild + type-drift check runs automatically on every PR that touches
`supabase/**` or the generated types, via `.github/workflows/db-contract.yml`
(disposable Supabase stack on a GitHub runner; never a hosted project).

Notes:
- `db:types` intentionally uses `--local` (no production project ref is hard-coded).
- `src/lib/database.types.ts` is generated — do not hand-edit. It is not yet wired
  into the Supabase clients; typing `createClient<Database>(...)` is a later
  application-code change.
- To compare against production read-only (parity check only, never as the
  canonical source): `npx supabase gen types typescript --project-id <ref> --schema public`.

## 3. Migration ordering

Fresh databases apply migrations in this order (filename timestamp order):

1. `supabase/migrations/20260902000000_baseline.sql` — complete current-state
   contract (additive; the authoritative foundation).
2. `supabase/migrations/20260903003819_listings_select_own_submissions.sql`
3. `supabase/migrations/20260903024646_staff_sourced_listings.sql`
4. `supabase/migrations/20260903074515_listing_staff_metadata.sql`

The three incrementals (2–4) carry the **exact remote-recorded versions** and the
unchanged SQL from `main`. They are self-guarding (`IF NOT EXISTS`,
`DROP POLICY IF EXISTS ... CREATE`, `CREATE OR REPLACE`), so re-applying them
after the baseline is a no-op that converges on the same final state. The
`staff_review_note` column is transiently added by migration 3 and dropped by
migration 4, matching production (the column does not exist in the final schema).

## 4. Local vs remote migration-history timestamps

The original `main` migration **filenames** never matched the versions recorded in
production:

| Name | `main` file version (historical) | Remote recorded version (authoritative) |
|---|---|---|
| listings_select_own_submissions | `20260902153000` | `20260903003819` |
| staff_sourced_listings | `20260903023900` | `20260903024646` |
| listing_staff_metadata | `20260903074200` | `20260903074515` |

This branch **renames** the incrementals to the remote versions and does **not**
retain the old mismatched filenames. The additive `20260902000000_baseline`
migration exists only in the repository.

## 5. Future baseline migration-repair requirement (do NOT do now)

Production's `supabase_migrations.schema_migrations` currently contains only the
three incremental versions (`20260903003819`, `20260903024646`, `20260903074515`).
It has **no** row for `20260902000000_baseline`.

> This is **not** a blocker to merging this branch into `main` — merging does not
> touch production. It only becomes relevant the first time someone runs
> `supabase db push` against the production project, at which point the
> reconciliation below must already have happened.

Therefore, before any future `supabase db push` to production:

- A **separately approved migration-history reconciliation** is required so
  production records the baseline as already applied without re-running it, e.g.
  `supabase migration repair --status applied 20260902000000` against the
  production project.
- This is a production **metadata** change. It must not be bundled with schema
  work, and must not be performed during contract capture.
- Until then, do not run `db push`, `db pull`, `config push`, `migration repair`,
  or `db reset --linked` against production. Development work uses a **separate**
  hosted development project (to be created later) or a local stack.

## 6. Hosted Auth settings not recreated by SQL

Migrations do not capture Supabase Auth configuration. A development project must
be configured to match required behavior (and `supabase/config.toml` only covers
the local stack). Inventory and set these deliberately per environment:

- Anonymous sign-ins: **enabled** (required for confirmations, reports, community
  submissions).
- Email sign-in / sign-up: enabled; email auto-confirmation intentionally chosen
  (off locally for convenience).
- Email/password sign-in for administrators.
- Site URL and additional redirect URLs (do **not** push a localhost-only
  `site_url` to a hosted project).
- Email templates, SMTP provider, rate limits, password policy, and any
  CAPTCHA/bot protection.
- **Leaked password protection is currently disabled in production** (advisor
  warning) — decide intentionally when configuring environments.

Admin membership is `public.admin_users` keyed to a non-anonymous Auth user;
create a development-only admin and add its UUID in dev. Never copy production
users, sessions, passwords, or contributor identities.

## 7. Known bug — contributor_profiles privileges (next separate migration)

Verified read-only on production: role `authenticated` has **`SELECT` only** on
`public.contributor_profiles`, but the table has `INSERT` and `UPDATE` RLS
policies. PostgreSQL requires both a table privilege **and** a passing policy, so
contributor profile creation/update is blocked at the database level for the app's
roles (the app does not use the service-role key).

The baseline reproduces this faithfully (it is a snapshot). The fix is a
**separate forward migration/PR**, to be created **after** the production baseline
history is secured — not added to this branch:

```sql
grant insert, update on public.contributor_profiles to authenticated;
```

## 8. Related security follow-ups (separate PRs)

Reproduced as-is in the baseline and flagged inline; to be tightened via forward
migrations, never baked into the snapshot:

- `public.listings` grants `ALL` to `anon` and `authenticated` (RLS is the only
  gate); anonymous callers can read every column of approved rows, including
  `submitted_by`.
- "Anyone can submit pending listings" targets role `PUBLIC` and does not require a
  non-null submitter, allowing unattributed pending inserts.
- `source_url` has no protocol constraint at the database boundary.
