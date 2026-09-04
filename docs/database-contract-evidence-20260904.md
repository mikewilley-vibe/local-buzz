# Database contract — catalog evidence report (2026-09-04)

Project: `local-buzz` (`vghnfdukyosvvoqrxmok`).

This is a **catalog evidence report**, not a SQL dump. It records the live
database contract as observed through **read-only** catalog queries
(`information_schema` / `pg_catalog`) against the hosted project. No SQL was
applied, no migration was run, and no production object, policy, grant, Auth
setting, or migration-history row was changed to produce it.

Sanitization: contains no keys, passwords, tokens, connection strings, row data,
contributor UUIDs, or admin credentials.

Purpose: serve as the reference used to confirm that
`supabase/migrations/20260902000000_baseline.sql` is a faithful snapshot, and to
drive the local rebuild + zero-diff check before a development project is created.

---

## Migration history (local vs remote)

Remote recorded history (`supabase_migrations.schema_migrations`):

| Version | Name |
|---|---|
| `20260903003819` | listings_select_own_submissions |
| `20260903024646` | staff_sourced_listings |
| `20260903074515` | listing_staff_metadata |

The repository now stores the three incrementals under these **exact remote
versions**, preceded by the additive baseline. The production project does **not**
yet contain a history row for `20260902000000_baseline`. See
`docs/database-contract.md` for the required future reconciliation.

## Schemas, extensions, enums

- Application schemas: `public`, `private` (trigger functions; not exposed via PostgREST).
- Extensions: `pgcrypto`, `uuid-ossp` (both in the `extensions` schema).
- User-defined enum types in `public`/`private`: **none**. Business value sets are
  `text` + CHECK constraints (so generated TS represents them as `string`).

## Tables (7) — RLS enabled on all; none use FORCE RLS

`admin_users`, `contributor_profiles`, `listing_confirmations`, `listing_reports`,
`listing_staff_metadata`, `listings`, `point_events`.

### Column shape (types / nullability / defaults)

- `listings` (20 cols): `id uuid !null default gen_random_uuid()`, `place_name text !null`,
  `city text !null`, `listing_type text !null`, `days text[] !null`, `start_time time null`,
  `end_time time null`, `description text !null`, `source_url text null`,
  `status text !null default 'pending'`, `confirmation_count int !null default 0`,
  `submitted_at timestamptz !null default now()`, `last_verified_at timestamptz null`,
  `created_at timestamptz !null default now()`, `updated_at timestamptz !null default now()`,
  `street_address text null`, `zip_code text null`, `submitted_by uuid null`,
  `source_checked_at timestamptz null`, `is_staff_sourced boolean !null default false`.
- `listing_confirmations`: `id uuid pk default gen_random_uuid()`, `listing_id uuid !null`,
  `user_id uuid !null`, `created_at timestamptz !null default now()`.
- `listing_reports`: `id`, `listing_id`, `user_id`, `reason text !null`, `note text null`,
  `status text !null default 'pending'`, `created_at`.
- `admin_users`: `user_id uuid pk`, `created_at`.
- `contributor_profiles`: `user_id uuid pk`, `display_name text !null`, `created_at`.
- `point_events`: `id`, `user_id uuid !null`, `listing_id uuid null`, `confirmation_id uuid null`,
  `event_type text !null`, `points int !null`, `source_key text !null`, `created_at`.
- `listing_staff_metadata`: `listing_id uuid pk`, `review_note text null`, `created_at`, `updated_at`.

## Constraints — 34 named (7 PK, 3 UNIQUE, FKs, CHECKs)

- FKs to `auth.users(id)`: `listings.submitted_by` (ON DELETE SET NULL);
  `admin_users.user_id`, `contributor_profiles.user_id`,
  `listing_confirmations.user_id`, `listing_reports.user_id`,
  `point_events.user_id` (ON DELETE CASCADE).
- Cross-table FKs (ON DELETE CASCADE): `listing_confirmations.listing_id`,
  `listing_reports.listing_id`, `listing_staff_metadata.listing_id`,
  `point_events.listing_id`, `point_events.confirmation_id`.
- UNIQUE: `listing_confirmations(listing_id,user_id)`, `listing_reports(listing_id,user_id)`,
  `point_events(source_key)`.
- CHECKs: cities (8-value list), listing_type (6-value), status (4-value),
  `days` non-empty subset of Mon–Sun, `confirmation_count >= 0`,
  street_address length <= 200, zip `^[0-9]{5}(-[0-9]{4})?$`,
  report reason (5-value), report status (3-value), report note length <= 500,
  contributor display_name trimmed length 2..30, point event_type (2-value), `points > 0`.

## Indexes — 12 total; 2 explicit non-constraint

- `listings_submitted_by_idx` on `listings(submitted_by)`
- `listings_zip_code_idx` on `listings(zip_code)`
- Remaining 10 back PK/UNIQUE constraints. No production-only extras found.

## Functions (schema `private`, owner `postgres`)

| Function | Security | search_path |
|---|---|---|
| `set_listing_submitter()` | INVOKER | `''` |
| `update_listing_confirmation()` | DEFINER | `''` |
| `award_listing_approval_points()` | DEFINER | `''` |
| `award_listing_confirmation_points()` | DEFINER | `''` |

No functions in `public`.

## Triggers (4)

- `set_listing_submitter` — BEFORE INSERT ON `listings`
- `award_listing_approval_points` — AFTER UPDATE OF status ON `listings`
- `award_listing_confirmation_points` — AFTER INSERT ON `listing_confirmations`
- `update_listing_after_confirmation` — AFTER INSERT ON `listing_confirmations`

## Table grants (public schema)

| Table | anon | authenticated |
|---|---|---|
| `listings` | ALL | ALL |
| `listing_confirmations` | — | SELECT, INSERT |
| `listing_reports` | — | SELECT, INSERT, UPDATE |
| `admin_users` | — | SELECT |
| `contributor_profiles` | — | **SELECT only** |
| `point_events` | — | SELECT |
| `listing_staff_metadata` | — | SELECT, INSERT, UPDATE, DELETE |

`postgres` and `service_role` hold full privileges on all tables (Supabase default).

## RLS policies — 21 (all PERMISSIVE)

- `listings` (6): read approved `{anon,authenticated}`; `listings_select_own_submissions`
  (authenticated, own); admin read-all; admin update; "Anyone can submit pending listings"
  (**role PUBLIC**, INSERT, checks status/count/last_verified/is_staff_sourced only);
  "Admins can insert staff listings".
- `listing_confirmations` (2): authenticated insert own for approved listing; read own.
- `listing_reports` (4): authenticated insert own (pending, approved listing); read own;
  admin read-all; admin update.
- `admin_users` (1): authenticated can read only its own membership row.
- `contributor_profiles` (3): read own; insert own when not anonymous; update own when not anonymous.
- `point_events` (1): read own (no client INSERT policy — writes come only from the
  SECURITY DEFINER triggers).
- `listing_staff_metadata` (4): admin-only select/insert/update/delete.

## contributor_profiles effective privileges (`has_table_privilege`)

| Role | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| authenticated | true | **false** | **false** | false |
| anon | false | false | false | false |

INSERT/UPDATE **policies** exist but the **table privilege** does not, so profile
create/update is blocked at the DB level for the app's roles. The baseline
reproduces this faithfully; the fix is a separate forward migration (see
`docs/database-contract.md`).

## Security advisors (read-only)

- `auth_allow_anonymous_sign_ins` (WARN) x7 — one per table, because anonymous
  sign-in is enabled and policies apply to roles used by anonymous sessions.
- `auth_leaked_password_protection` (WARN) — disabled (admin email/password auth).

## Verdict

Live `public` + `private` schema matches `20260902000000_baseline.sql` with **zero
differences** across tables, columns, constraints, indexes, functions (incl.
security + search_path), triggers, grants, and RLS policies. Generated
`src/lib/database.types.ts` matches a read-only generation (public schema; enums
as `string`). Outstanding items are migration-history reconciliation, the
`contributor_profiles` grant bug, and the §9 security hardening — all tracked as
separate forward work, none of which changes the fidelity of the snapshot.
