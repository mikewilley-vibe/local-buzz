-- Staff-sourced seed listings: provenance columns, no contributor points,
-- and admin-only insert of pending staff rows. Community submission and
-- existing point awards for submitted_by contributors are unchanged.
-- Idempotent: additive columns and CREATE OR REPLACE functions.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS source_checked_at timestamptz;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_staff_sourced boolean;

UPDATE public.listings
SET is_staff_sourced = false
WHERE is_staff_sourced IS NULL;

ALTER TABLE public.listings
  ALTER COLUMN is_staff_sourced SET DEFAULT false;

ALTER TABLE public.listings
  ALTER COLUMN is_staff_sourced SET NOT NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS staff_review_note text;

-- Workbook blanks mean all-day or unpublished; do not invent a start time.
ALTER TABLE public.listings
  ALTER COLUMN start_time DROP NOT NULL;

CREATE OR REPLACE FUNCTION private.set_listing_submitter()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if coalesce(new.is_staff_sourced, false) then
    new.submitted_by := null;
  else
    new.submitted_by := (select auth.uid());
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.award_listing_approval_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'approved'
     and old.status is distinct from 'approved'
     and new.submitted_by is not null
     and coalesce(new.is_staff_sourced, false) = false then

    insert into public.point_events (
      user_id,
      listing_id,
      confirmation_id,
      event_type,
      points,
      source_key
    )
    values (
      new.submitted_by,
      new.id,
      null,
      'listing_approved',
      5,
      'listing-approved:' || new.id::text
    )
    on conflict (source_key) do nothing;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.award_listing_confirmation_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  contributor_id uuid;
  staff_sourced boolean;
begin
  select submitted_by, is_staff_sourced
  into contributor_id, staff_sourced
  from public.listings
  where id = new.listing_id;

  if contributor_id is not null
     and coalesce(staff_sourced, false) = false
     and contributor_id <> new.user_id then

    insert into public.point_events (
      user_id,
      listing_id,
      confirmation_id,
      event_type,
      points,
      source_key
    )
    values (
      contributor_id,
      new.listing_id,
      new.id,
      'listing_confirmed',
      1,
      'confirmation:' || new.id::text
    )
    on conflict (source_key) do nothing;
  end if;

  return new;
end;
$function$;

DROP POLICY IF EXISTS "Anyone can submit pending listings" ON public.listings;

CREATE POLICY "Anyone can submit pending listings"
  ON public.listings
  FOR INSERT
  WITH CHECK (
    (status = 'pending'::text)
    AND (confirmation_count = 0)
    AND (last_verified_at IS NULL)
    AND (is_staff_sourced = false)
  );

DROP POLICY IF EXISTS "Admins can insert staff listings" ON public.listings;

CREATE POLICY "Admins can insert staff listings"
  ON public.listings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
    ))
    AND (status = 'pending'::text)
    AND (confirmation_count = 0)
    AND (last_verified_at IS NULL)
    AND (is_staff_sourced = true)
    AND (submitted_by IS NULL)
  );
