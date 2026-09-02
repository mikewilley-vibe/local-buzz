"use client";

import { useEffect, useState } from "react";
import { listingPreview } from "@/lib/admin";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDisplayDate } from "@/lib/week";

const GENERIC_ERROR = "Couldn’t update that listing. Please try again.";
const LOAD_ERROR = "Couldn’t load pending listings. Please try again.";

type PendingListing = {
  id: string;
  placeName: string;
  city: string;
  typeLabel: string;
  daysLabel: string;
  timeLabel: string;
  description: string;
  sourceUrl: string | null;
  submittedLabel: string | null;
};

type ListingAction = "approve" | "reject";

export function PendingListingsPanel({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, place_name, city, listing_type, days, start_time, end_time, description, source_url, submitted_at, created_at",
          )
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (cancelled) return;

        if (error) {
          setErrorMessage(LOAD_ERROR);
          setListings([]);
          onCountChange(0);
          setLoading(false);
          return;
        }

        const next = (data ?? []).map((row) => {
          const preview = listingPreview(row);
          const submitted = formatDisplayDate(
            row.submitted_at ?? row.created_at ?? "",
          );
          return {
            id: row.id,
            ...preview,
            submittedLabel: submitted,
          };
        });

        setListings(next);
        onCountChange(next.length);
      } catch {
        if (!cancelled) {
          setErrorMessage(LOAD_ERROR);
          setListings([]);
          onCountChange(0);
        }
      }

      if (!cancelled) setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [onCountChange]);

  async function updateStatus(id: string, action: ListingAction) {
    setErrorMessage(null);
    setSavingId(id);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("listings")
        .update({ status: action === "approve" ? "approved" : "rejected" })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");

      if (error || !data?.length) {
        setErrorMessage(GENERIC_ERROR);
        setSavingId(null);
        return;
      }

      setListings((current) => {
        const next = current.filter((listing) => listing.id !== id);
        onCountChange(next.length);
        return next;
      });
      setConfirmRejectId(null);
    } catch {
      setErrorMessage(GENERIC_ERROR);
    }

    setSavingId(null);
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--muted)]" role="status">
        Loading pending listings…
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

      {listings.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-6 text-sm text-[var(--muted)]">
          No pending listings.
        </p>
      ) : (
        listings.map((listing) => {
          const busy = savingId === listing.id;
          const confirming = confirmRejectId === listing.id;

          return (
            <article
              key={listing.id}
              className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
                  {listing.typeLabel}
                </p>
                <h2 className="mt-1 font-display text-2xl text-[var(--ink)]">
                  {listing.placeName}
                </h2>
                <p className="text-sm text-[var(--muted)]">{listing.city}</p>
              </div>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="font-medium text-[var(--ink)]">Days</dt>
                  <dd className="text-[var(--muted)]">{listing.daysLabel}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--ink)]">Time</dt>
                  <dd className="text-[var(--muted)]">{listing.timeLabel}</dd>
                </div>
                {listing.submittedLabel ? (
                  <div>
                    <dt className="font-medium text-[var(--ink)]">Submitted</dt>
                    <dd className="text-[var(--muted)]">{listing.submittedLabel}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-sm leading-relaxed text-[var(--ink)]">
                {listing.description}
              </p>
              {listing.sourceUrl ? (
                <p className="text-sm">
                  <a
                    href={listing.sourceUrl}
                    className="break-all text-[var(--amber-deep)] underline outline-none ring-[var(--amber)] focus-visible:ring-2"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {listing.sourceUrl}
                  </a>
                </p>
              ) : null}

              {confirming ? (
                <div className="grid gap-2">
                  <p className="text-sm text-[var(--ink)]" role="status">
                    Reject this listing? It will not appear on the calendar.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(listing.id, "reject")}
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
                    >
                      {busy ? "Saving…" : "Yes, reject"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmRejectId(null)}
                      className="inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void updateStatus(listing.id, "approve")}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmRejectId(listing.id)}
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
