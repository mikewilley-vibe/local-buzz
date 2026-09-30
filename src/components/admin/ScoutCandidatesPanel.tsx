"use client";

import { useEffect, useState } from "react";
import { revalidatePublicListings } from "@/app/admin/actions";
import { logDevOperationError } from "@/lib/dev-log";
import {
  clipScoutExcerpt,
  groupScoutCandidatesByVenue,
  GENERIC_HAPPY_HOUR_REJECTION_REASON,
  isGenericRecurringPromotion,
} from "@/lib/scout/value-filter";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Evidence = {
  id: string;
  source_url: string;
  source_kind: string;
  source_title: string | null;
  excerpt: string;
  captured_at: string;
};

type ScoutCandidate = {
  id: string;
  place_name: string;
  city: string;
  listing_type: string;
  days: string[];
  start_time: string | null;
  end_time: string | null;
  description: string;
  source_url: string;
  confidence: number;
  last_checked_at: string;
  expires_at: string;
  listing_candidate_evidence: Evidence[];
};

const LOAD_ERROR = "Couldn’t load Scout candidates. Please try again.";
const ACTION_ERROR = "Couldn’t update that Scout candidate. Please try again.";
const CLEANUP_ERROR = "Couldn’t clean up generic happy hours. Please try again.";

function asScoutValue(candidate: {
  listing_type: string;
  days: string[];
  description: string;
  place_name?: string;
  start_time?: string | null;
}) {
  return {
    listingType: candidate.listing_type,
    days: candidate.days,
    description: candidate.description,
    placeName: candidate.place_name,
    startTime: candidate.start_time,
  };
}

function formatSchedule(candidate: ScoutCandidate) {
  const days = candidate.days.map((day) => day.slice(0, 3)).join(", ");
  const start = candidate.start_time?.slice(0, 5) ?? "Any time";
  const end = candidate.end_time?.slice(0, 5);
  return `${days} · ${start}${end ? `–${end}` : ""}`;
}

export function ScoutCandidatesPanel({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const [candidates, setCandidates] = useState<ScoutCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("listing_candidates")
          .select(
            "id, place_name, city, listing_type, days, start_time, end_time, description, source_url, confidence, last_checked_at, expires_at, listing_candidate_evidence(id, source_url, source_kind, source_title, excerpt, captured_at)",
          )
          .eq("status", "pending_review")
          .order("confidence", { ascending: false })
          .order("expires_at", { ascending: true });

        if (cancelled) return;

        if (error) {
          logDevOperationError("load Scout candidates", error);
          setErrorMessage(LOAD_ERROR);
          setCandidates([]);
          return;
        }

        const rows = (data ?? []) as ScoutCandidate[];
        const groups = groupScoutCandidatesByVenue(rows);
        setCandidates(groups.flatMap((group) => group.offers));
      } catch (error) {
        logDevOperationError("load Scout candidates", error);
        if (!cancelled) {
          setErrorMessage(LOAD_ERROR);
          setCandidates([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onCountChange(candidates.length);
  }, [candidates.length, onCountChange]);

  async function publish(candidate: ScoutCandidate) {
    setSavingId(candidate.id);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("publish_listing_candidate", {
        p_candidate_id: candidate.id,
        p_review_note: notes[candidate.id]?.trim() || null,
      });

      if (error) {
        logDevOperationError("publish Scout candidate", error);
        setErrorMessage(ACTION_ERROR);
        return;
      }

      setCandidates((current) => current.filter((item) => item.id !== candidate.id));
      await revalidatePublicListings();
    } catch (error) {
      logDevOperationError("publish Scout candidate", error);
      setErrorMessage(ACTION_ERROR);
    } finally {
      setSavingId(null);
    }
  }

  async function rejectGenericHappyHours() {
    const generic = candidates.filter((candidate) =>
      isGenericRecurringPromotion(asScoutValue(candidate)),
    );
    const confirmed = window.confirm(
      generic.length > 0
        ? `Reject ${generic.length} generic happy-hour candidate${generic.length === 1 ? "" : "s"} and hide matching public listings? Records stay in the database.`
        : "Hide matching generic happy-hour listings from the public app? Records stay in the database.",
    );
    if (!confirmed) return;

    setCleaning(true);
    setErrorMessage(null);
    setCleanupMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      let rejectedCount = 0;
      for (const candidate of generic) {
        const { error } = await supabase.rpc("reject_listing_candidate", {
          p_candidate_id: candidate.id,
          p_reason: GENERIC_HAPPY_HOUR_REJECTION_REASON,
        });
        if (error) {
          logDevOperationError("reject generic Scout candidate", error);
          setErrorMessage(CLEANUP_ERROR);
          return;
        }
        rejectedCount += 1;
      }

      const { data: listings, error: listingsError } = await supabase
        .from("listings")
        .select("id, place_name, listing_type, days, description, start_time, status")
        .eq("status", "approved");
      if (listingsError) {
        logDevOperationError("load listings for generic happy-hour cleanup", listingsError);
        setErrorMessage(CLEANUP_ERROR);
        return;
      }

      let outdatedCount = 0;
      for (const listing of listings ?? []) {
        if (
          !isGenericRecurringPromotion({
            listingType: listing.listing_type,
            days: listing.days,
            description: listing.description,
            placeName: listing.place_name,
            startTime: listing.start_time,
          })
        ) {
          continue;
        }
        const { error } = await supabase
          .from("listings")
          .update({ status: "outdated" })
          .eq("id", listing.id)
          .eq("status", "approved");
        if (error) {
          logDevOperationError("outdate generic happy-hour listing", error);
          setErrorMessage(CLEANUP_ERROR);
          return;
        }
        outdatedCount += 1;
      }

      setCandidates((current) =>
        current.filter((candidate) => !isGenericRecurringPromotion(asScoutValue(candidate))),
      );
      await revalidatePublicListings();
      setCleanupMessage(
        `Rejected ${rejectedCount} Scout candidate${rejectedCount === 1 ? "" : "s"} and marked ${outdatedCount} public listing${outdatedCount === 1 ? "" : "s"} outdated.`,
      );
    } catch (error) {
      logDevOperationError("clean up generic happy hours", error);
      setErrorMessage(CLEANUP_ERROR);
    } finally {
      setCleaning(false);
    }
  }

  async function reject(candidate: ScoutCandidate) {
    const reason = notes[candidate.id]?.trim() || "Evidence was not sufficient for publication.";
    setSavingId(candidate.id);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("reject_listing_candidate", {
        p_candidate_id: candidate.id,
        p_reason: reason,
      });

      if (error) {
        logDevOperationError("reject Scout candidate", error);
        setErrorMessage(ACTION_ERROR);
        return;
      }

      setCandidates((current) => current.filter((item) => item.id !== candidate.id));
      setRejectingId(null);
    } catch (error) {
      logDevOperationError("reject Scout candidate", error);
      setErrorMessage(ACTION_ERROR);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--muted)]" role="status">
        Loading Scout candidates…
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {errorMessage ? (
        <p className="text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {cleanupMessage ? (
        <p className="text-sm text-[var(--ink)]" role="status">
          {cleanupMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          Scout should keep named events and concrete deals, not everyday happy hour.
        </p>
        <button
          type="button"
          disabled={cleaning}
          onClick={() => void rejectGenericHappyHours()}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60"
        >
          {cleaning ? "Cleaning…" : "Reject generic happy hours"}
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-6 text-sm text-[var(--muted)]">
          No Scout candidates are waiting for review.
        </p>
      ) : (
        groupScoutCandidatesByVenue(candidates).map((group) => (
          <article
            key={`${group.placeName}-${group.city}`}
            className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5"
          >
            <div>
              <h2 className="font-display text-2xl text-[var(--ink)]">{group.placeName}</h2>
              <p className="text-sm text-[var(--muted)]">{group.city}</p>
            </div>

            {group.offers.map((candidate) => {
              const busy = savingId === candidate.id;
              const rejecting = rejectingId === candidate.id;
              const evidence = candidate.listing_candidate_evidence?.[0];
              const quote = evidence?.excerpt ? clipScoutExcerpt(evidence.excerpt) : null;

              return (
                <div
                  key={candidate.id}
                  className="grid gap-3 border-t border-[var(--line)] pt-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
                    {candidate.listing_type} · {Math.round(candidate.confidence * 100)}% confidence
                  </p>
                  <p className="text-sm text-[var(--muted)]">{formatSchedule(candidate)}</p>
                  <p className="text-sm leading-relaxed text-[var(--ink)]">{candidate.description}</p>

                  <div className="grid gap-1 text-sm">
                    {quote ? <p className="text-[var(--muted)]">“{quote}”</p> : null}
                    <a
                      href={evidence?.source_url || candidate.source_url}
                      className="w-fit text-[var(--amber-deep)] underline outline-none ring-[var(--amber)] focus-visible:ring-2"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open source
                    </a>
                  </div>

                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-[var(--ink)]">
                      {rejecting ? "Rejection reason" : "Review note (optional)"}
                    </span>
                    <textarea
                      value={notes[candidate.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [candidate.id]: event.target.value }))
                      }
                      maxLength={rejecting ? 500 : 900}
                      rows={2}
                      placeholder={rejecting ? "Why should this candidate be rejected?" : "What did you verify?"}
                      className="min-h-16 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[var(--ink)] outline-none ring-[var(--amber)] focus-visible:ring-2"
                    />
                  </label>

                  {rejecting ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void reject(candidate)}
                        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
                      >
                        {busy ? "Saving…" : "Confirm rejection"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRejectingId(null)}
                        className="inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void publish(candidate)}
                        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
                      >
                        {busy ? "Saving…" : "Publish listing"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRejectingId(candidate.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </article>
        ))
      )}
    </div>
  );
}
