"use client";

import { useEffect, useState } from "react";
import { revalidatePublicListings } from "@/app/admin/actions";
import { listingPreview } from "@/lib/admin";
import { logDevOperationError } from "@/lib/dev-log";
import { seedFromListingRow } from "@/lib/listing-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDisplayDate } from "@/lib/week";
import { DirectionsLink } from "@/components/DirectionsLink";
import {
  AdminListingEditor,
  type AdminListingEditTarget,
  type SavedListingRow,
} from "./AdminListingEditor";

const GENERIC_ERROR = "Couldn’t update that listing. Please try again.";
const LOAD_ERROR = "Couldn’t load pending listings. Please try again.";
const SAVE_SUCCESS = "Listing updated. It is still pending review.";

type PendingListing = {
  id: string;
  submittedLabel: string | null;
  preview: ReturnType<typeof listingPreview>;
  values: ReturnType<typeof seedFromListingRow>;
};

type ListingAction = "approve" | "reject";

function mapPendingRow(row: SavedListingRow & {
  submitted_at?: string | null;
  created_at?: string | null;
}): PendingListing {
  return {
    id: row.id,
    preview: listingPreview(row),
    values: seedFromListingRow(row),
    submittedLabel: formatDisplayDate(row.submitted_at ?? row.created_at ?? ""),
  };
}

export function PendingListingsPanel({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminListingEditTarget | null>(null);

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
            "id, place_name, city, listing_type, days, start_time, end_time, description, source_url, street_address, zip_code, submitted_at, created_at",
          )
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (cancelled) return;

        if (error) {
          logDevOperationError("load pending listings", error);
          setErrorMessage(LOAD_ERROR);
          setListings([]);
          return;
        }

        setListings((data ?? []).map((row) => mapPendingRow(row)));
      } catch (error) {
        logDevOperationError("load pending listings", error);
        if (!cancelled) {
          setErrorMessage(LOAD_ERROR);
          setListings([]);
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
    onCountChange(listings.length);
  }, [listings.length, onCountChange]);

  async function updateStatus(id: string, action: ListingAction) {
    setErrorMessage(null);
    setSuccessMessage(null);
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
        logDevOperationError("update pending listing status", error);
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      setListings((current) => current.filter((listing) => listing.id !== id));
      setConfirmRejectId(null);
      if (action === "approve") {
        await revalidatePublicListings();
      }
    } catch (error) {
      logDevOperationError("update pending listing status", error);
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setSavingId(null);
    }
  }

  function onSaved(row: SavedListingRow) {
    setListings((current) =>
      current.map((listing) =>
        listing.id === row.id
          ? {
              ...listing,
              preview: listingPreview(row),
              values: seedFromListingRow(row),
            }
          : listing,
      ),
    );
    setEditing(null);
    setErrorMessage(null);
    setSuccessMessage(SAVE_SUCCESS);
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
      {successMessage ? (
        <p
          className="rounded-xl border border-[var(--line)] bg-[var(--wash)] px-4 py-3 text-sm text-[var(--ink)]"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

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
                  {listing.preview.typeLabel}
                </p>
                <h2 className="mt-1 font-display text-2xl text-[var(--ink)]">
                  {listing.preview.placeName}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {listing.preview.fullLocation}
                </p>
                <DirectionsLink
                  location={{
                    streetAddress: listing.preview.streetAddress,
                    city: listing.preview.city,
                    zipCode: listing.preview.zipCode,
                  }}
                />
              </div>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="font-medium text-[var(--ink)]">Days</dt>
                  <dd className="text-[var(--muted)]">{listing.preview.daysLabel}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--ink)]">Time</dt>
                  <dd className="text-[var(--muted)]">{listing.preview.timeLabel}</dd>
                </div>
                {listing.submittedLabel ? (
                  <div>
                    <dt className="font-medium text-[var(--ink)]">Submitted</dt>
                    <dd className="text-[var(--muted)]">{listing.submittedLabel}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-sm leading-relaxed text-[var(--ink)]">
                {listing.preview.description}
              </p>
              {listing.preview.sourceUrl ? (
                <p className="text-sm">
                  <a
                    href={listing.preview.sourceUrl}
                    className="break-all text-[var(--amber-deep)] underline outline-none ring-[var(--amber)] focus-visible:ring-2"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {listing.preview.sourceUrl}
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
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
                    onClick={() => {
                      setSuccessMessage(null);
                      setEditing({
                        id: listing.id,
                        expectedStatus: "pending",
                        values: listing.values,
                      });
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60"
                  >
                    Edit
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

      {editing ? (
        <AdminListingEditor
          key={editing.id}
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}
