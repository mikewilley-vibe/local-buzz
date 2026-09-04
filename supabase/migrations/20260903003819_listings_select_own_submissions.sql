-- Allow authenticated contributors to read their own listings,
-- including pending and rejected rows. Does not grant update, delete,
-- approve, or reject. Public approved listing access and administrator
-- policies are unchanged. Does not backfill submitted_by.

CREATE INDEX IF NOT EXISTS listings_submitted_by_idx
  ON public.listings (submitted_by);

DROP POLICY IF EXISTS listings_select_own_submissions ON public.listings;

CREATE POLICY listings_select_own_submissions
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (submitted_by = (SELECT auth.uid()));
