"use client";

import { useEffect, useState } from "react";
import { revalidatePublicListings } from "@/app/admin/actions";
import { logDevOperationError } from "@/lib/dev-log";
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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

        setCandidates((data ?? []) as ScoutCandidate[]);
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

      {candidates.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-6 text-sm text-[var(--muted)]">
          No Scout candidates are waiting for review.
        </p>
      ) : (
        candidates.map((candidate) => {
          const busy = savingId === candidate.id;
          const rejecting = rejectingId === candidate.id;

          return (
            <article
              key={candidate.id}
              className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
                  Found online · {Math.round(candidate.confidence * 100)}% confidence
                </p>
                <h2 className="mt-1 font-display text-2xl text-[var(--ink)]">
                  {candidate.place_name}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {candidate.city} · {candidate.listing_type}
                </p>
              </div>

              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="font-medium text-[var(--ink)]">Schedule</dt>
                  <dd className="text-[var(--muted)]">{formatSchedule(candidate)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--ink)]">Last checked</dt>
                  <dd className="text-[var(--muted)]">{formatDate(candidate.last_checked_at)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--ink)]">Evidence expires</dt>
                  <dd className="text-[var(--muted)]">{formatDate(candidate.expires_at)}</dd>
                </div>
              </dl>

              <p className="text-sm leading-relaxed text-[var(--ink)]">{candidate.description}</p>

              <div className="grid gap-2 rounded-xl bg-[var(--wash)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--amber-deep)]">
                  Source evidence
                </p>
                {candidate.listing_candidate_evidence?.map((evidence) => (
                  <div key={evidence.id} className="grid gap-1 text-sm">
                    <a
                      href={evidence.source_url}
                      className="break-all text-[var(--amber-deep)] underline outline-none ring-[var(--amber)] focus-visible:ring-2"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {evidence.source_title || evidence.source_url}
                    </a>
                    <p className="text-[var(--muted)]">“{evidence.excerpt}”</p>
                  </div>
                ))}
                <a
                  href={candidate.source_url}
                  className="break-all text-sm text-[var(--amber-deep)] underline outline-none ring-[var(--amber)] focus-visible:ring-2"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open primary source
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
                  rows={3}
                  placeholder={rejecting ? "Why should this candidate be rejected?" : "What did you verify?"}
                  className="min-h-20 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[var(--ink)] outline-none ring-[var(--amber)] focus-visible:ring-2"
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
            </article>
          );
        })
      )}
    </div>
  );
}
