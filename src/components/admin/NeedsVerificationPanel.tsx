"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { revalidatePublicListings } from "@/app/admin/actions";
import { listingPreview } from "@/lib/admin";
import { logDevOperationError } from "@/lib/dev-log";
import {
  classifyListingFreshness,
  FRESHNESS_LABELS,
  needsVerification,
} from "@/lib/freshness";
import { seedFromListingRow } from "@/lib/listing-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { confirmationCountLabel, formatVerifiedDate } from "@/lib/week";
import { DirectionsLink } from "@/components/DirectionsLink";
import {
  AdminListingEditor,
  type AdminListingEditTarget,
  type SavedListingRow,
} from "./AdminListingEditor";

const LOAD_ERROR = "Couldn’t load listings that need verification. Please try again.";
const SAVE_SUCCESS = "Listing updated. Verification status is unchanged.";

type VerificationListing = {
  id: string;
  preview: ReturnType<typeof listingPreview>;
  values: ReturnType<typeof seedFromListingRow>;
  lastVerifiedAt: string | null;
  confirmationCount: number;
  freshnessLabel: string;
};

type ListingRow = SavedListingRow & {
  last_verified_at?: string | null;
  confirmation_count?: number | null;
};

function mapRow(row: ListingRow): VerificationListing | null {
  const freshness = classifyListingFreshness(row.last_verified_at);
  if (!needsVerification(freshness)) return null;

  return {
    id: row.id,
    preview: listingPreview(row),
    values: seedFromListingRow(row),
    lastVerifiedAt: row.last_verified_at ?? null,
    confirmationCount: Number(row.confirmation_count ?? 0),
    freshnessLabel: FRESHNESS_LABELS[freshness],
  };
}

export function NeedsVerificationPanel({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const [listings, setListings] = useState<VerificationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
            "id, place_name, city, listing_type, days, start_time, end_time, description, source_url, street_address, zip_code, last_verified_at, confirmation_count",
          )
          .eq("status", "approved")
          .order("last_verified_at", { ascending: true, nullsFirst: true });

        if (cancelled) return;

        if (error) {
          logDevOperationError("load listings needing verification", error);
          setErrorMessage(LOAD_ERROR);
          setListings([]);
          return;
        }

        setListings(
          ((data ?? []) as ListingRow[]).flatMap((row) => {
            const listing = mapRow(row);
            return listing ? [listing] : [];
          }),
        );
      } catch (error) {
        logDevOperationError("load listings needing verification", error);
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
    void revalidatePublicListings();
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--muted)]" role="status">
        Loading listings that need verification…
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
          No listings need verification.
        </p>
      ) : (
        listings.map((listing) => {
          const verifiedLabel = listing.lastVerifiedAt
            ? formatVerifiedDate(listing.lastVerifiedAt)
            : null;

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

              <p className="text-sm font-medium text-[var(--ink)]">
                {listing.freshnessLabel}
              </p>

              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="font-medium text-[var(--ink)]">Schedule</dt>
                  <dd className="text-[var(--muted)]">
                    {listing.preview.daysLabel} · {listing.preview.timeLabel}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--ink)]">Last verified</dt>
                  <dd className="text-[var(--muted)]">{verifiedLabel ?? "Never"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--ink)]">Confirmations</dt>
                  <dd className="text-[var(--muted)]">
                    {confirmationCountLabel(listing.confirmationCount)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link
                  href={`/listings/${listing.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
                >
                  View listing
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessMessage(null);
                    setEditing({
                      id: listing.id,
                      expectedStatus: "approved",
                      values: listing.values,
                    });
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
                >
                  Edit listing
                </button>
              </div>
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
