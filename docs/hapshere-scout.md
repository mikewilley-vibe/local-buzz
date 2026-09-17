# HapsHere Scout foundation

HapsHere Scout is the staging and review boundary for specials or recurring
events discovered from public web sources. It supplements community submissions;
it does not replace them.

## Safety model

- Discovered records enter `listing_candidates`, never `listings`.
- Each candidate must retain at least one row in
  `listing_candidate_evidence`, including the source URL, a supporting excerpt,
  and when the evidence was captured.
- Anonymous and ordinary authenticated clients cannot read or write either
  staging table.
- A future server-side collector may write candidates with the Supabase
  `service_role`; that credential must never ship in the web or native apps.
- Only an authenticated administrator can call
  `publish_listing_candidate` or `reject_listing_candidate`.
- Publication is transactional. It creates one approved, staff-sourced listing,
  preserves an internal review note, and links the candidate to the resulting
  listing.
- Expired or more-than-30-day-old evidence cannot be published.
- A candidate cannot be published twice.

## This phase intentionally does not include

- A crawler, scheduled job, search provider, or AI model
- Social-network scraping
- Automatic public publication
- Production or development database deployment
- Changes to the existing community-submission flow

Those capabilities come only after the staging boundary and disposable-stack
tests are reviewed and deployed to the isolated development project.

## Controlled release order

1. Rebuild and test the migration on a disposable local Supabase stack.
2. Review the migration, RLS policies, generated types, and Scout tests.
3. Apply the migration to `local-buzz-dev` only.
4. Add the administrator review queue and test it with synthetic candidates.
5. Add a server-side collector for a small, approved Norfolk/Virginia Beach
   venue list.
6. Require source evidence and administrator review for every pilot candidate.
7. Observe duplicate, stale-source, and correction behavior before considering
   broader discovery or any production deployment.

No production database action is part of this foundation change.
