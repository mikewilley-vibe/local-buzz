"use client";

import { useEffect, useState } from "react";
import { listingPreview, reportReasonLabel } from "@/lib/admin";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDisplayDate } from "@/lib/week";

const GENERIC_ERROR = "Couldn’t update that report. Please try again.";
const LOAD_ERROR = "Couldn’t load change reports. Please try again.";

type PendingReport = {
  id: string;
  reasonLabel: string;
  note: string | null;
  reportedLabel: string | null;
  listing: ReturnType<typeof listingPreview> | null;
};

type ReportAction = "resolved" | "dismissed";

type ReportRow = {
  id: string;
  listing_id: string | null;
  reason: string | null;
  note: string | null;
  created_at: string | null;
};

type ListingLookup = {
  id: string;
  place_name?: string | null;
  city?: string | null;
  listing_type?: string | null;
  days?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  source_url?: string | null;
};

export function PendingReportsPanel({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("listing_reports")
          .select("id, listing_id, reason, note, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (cancelled) return;

        if (error) {
          setErrorMessage(LOAD_ERROR);
          setReports([]);
          onCountChange(0);
          setLoading(false);
          return;
        }

        const reportRows = (data ?? []) as ReportRow[];
        const listingIds = [
          ...new Set(
            reportRows
              .map((row) => row.listing_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        const listingById = new Map<string, ReturnType<typeof listingPreview>>();

        if (listingIds.length > 0) {
          const { data: listingData, error: listingError } = await supabase
            .from("listings")
            .select(
              "id, place_name, city, listing_type, days, start_time, end_time, description, source_url",
            )
            .in("id", listingIds);

          if (listingError) {
            setErrorMessage(LOAD_ERROR);
            setReports([]);
            onCountChange(0);
            setLoading(false);
            return;
          }

          for (const listing of (listingData ?? []) as ListingLookup[]) {
            listingById.set(listing.id, listingPreview(listing));
          }
        }

        const next = reportRows.map((row) => ({
          id: row.id,
          reasonLabel: reportReasonLabel(row.reason ?? ""),
          note: row.note?.trim() || null,
          reportedLabel: formatDisplayDate(row.created_at ?? ""),
          listing: row.listing_id ? listingById.get(row.listing_id) ?? null : null,
        }));

        setReports(next);
        onCountChange(next.length);
      } catch {
        if (!cancelled) {
          setErrorMessage(LOAD_ERROR);
          setReports([]);
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

  async function updateStatus(id: string, action: ReportAction) {
    setErrorMessage(null);
    setSavingId(id);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("listing_reports")
        .update({ status: action })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");

      if (error || !data?.length) {
        setErrorMessage(GENERIC_ERROR);
        setSavingId(null);
        return;
      }

      setReports((current) => {
        const next = current.filter((report) => report.id !== id);
        onCountChange(next.length);
        return next;
      });
    } catch {
      setErrorMessage(GENERIC_ERROR);
    }

    setSavingId(null);
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--muted)]" role="status">
        Loading change reports…
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

      {reports.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-6 text-sm text-[var(--muted)]">
          No pending change reports.
        </p>
      ) : (
        reports.map((report) => {
          const busy = savingId === report.id;

          return (
            <article
              key={report.id}
              className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
                  {report.reasonLabel}
                </p>
                <h2 className="mt-1 font-display text-2xl text-[var(--ink)]">
                  {report.listing?.placeName ?? "Listing unavailable"}
                </h2>
                {report.listing ? (
                  <p className="text-sm text-[var(--muted)]">
                    {report.listing.city} · {report.listing.typeLabel}
                  </p>
                ) : null}
              </div>

              {report.listing ? (
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="font-medium text-[var(--ink)]">Days</dt>
                    <dd className="text-[var(--muted)]">{report.listing.daysLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-[var(--ink)]">Time</dt>
                    <dd className="text-[var(--muted)]">{report.listing.timeLabel}</dd>
                  </div>
                </dl>
              ) : null}

              {report.listing ? (
                <p className="text-sm leading-relaxed text-[var(--ink)]">
                  {report.listing.description}
                </p>
              ) : null}

              {report.note ? (
                <p className="text-sm leading-relaxed text-[var(--ink)]">
                  <span className="font-medium">Note: </span>
                  {report.note}
                </p>
              ) : null}

              {report.reportedLabel ? (
                <p className="text-sm text-[var(--muted)]">
                  Reported {report.reportedLabel}
                </p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateStatus(report.id, "resolved")}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Resolve"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateStatus(report.id, "dismissed")}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60"
                >
                  Dismiss
                </button>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
