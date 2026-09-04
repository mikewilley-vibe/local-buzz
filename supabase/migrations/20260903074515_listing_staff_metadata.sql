-- Move internal staff review notes off listings so approved-row SELECT
-- cannot return them through PostgREST. No staff rows exist yet.

CREATE TABLE IF NOT EXISTS public.listing_staff_metadata (
  listing_id uuid PRIMARY KEY REFERENCES public.listings (id) ON DELETE CASCADE,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_staff_metadata ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.listing_staff_metadata FROM PUBLIC;
REVOKE ALL ON TABLE public.listing_staff_metadata FROM anon;
REVOKE ALL ON TABLE public.listing_staff_metadata FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.listing_staff_metadata
  TO authenticated;

DROP POLICY IF EXISTS "Admins can select listing staff metadata"
  ON public.listing_staff_metadata;
DROP POLICY IF EXISTS "Admins can insert listing staff metadata"
  ON public.listing_staff_metadata;
DROP POLICY IF EXISTS "Admins can update listing staff metadata"
  ON public.listing_staff_metadata;
DROP POLICY IF EXISTS "Admins can delete listing staff metadata"
  ON public.listing_staff_metadata;

CREATE POLICY "Admins can select listing staff metadata"
  ON public.listing_staff_metadata
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can insert listing staff metadata"
  ON public.listing_staff_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can update listing staff metadata"
  ON public.listing_staff_metadata
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can delete listing staff metadata"
  ON public.listing_staff_metadata
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE admin_users.user_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS staff_review_note;
