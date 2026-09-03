"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { logDevOperationError, logDevTiming } from "@/lib/dev-log";
import {
  buildStaffImportPreview,
  staffImportDuplicateFilters,
  uniqueStaffPreviewRows,
  validateStaffWorkbookFile,
  IMPORT_CANDIDATES_SHEET,
  STAFF_IMPORT_DUPLICATE_FETCH_LIMIT,
  STAFF_IMPORT_DUPLICATE_STATUSES,
  STAFF_IMPORT_PREVIEW_TIMEOUT_MS,
  type StaffImportInsert,
  type StaffImportPreview,
  type StaffImportPreviewRow,
} from "@/lib/staff-import";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatVerifiedDate } from "@/lib/week";
import { readWorkbookSheet } from "@/lib/xlsx-sheet";

const LOAD_ERROR = "Couldn’t read that workbook. Please try again.";
const INSERT_ERROR = "Couldn’t insert staff listings. Please try again.";
const EXISTING_ERROR = "Couldn’t check existing listings for duplicates. Please try again.";
const TIMEOUT_ERROR =
  "Preview timed out after 15 seconds. Check your connection and try again.";
const CANCELLED_ERROR = "Preview cancelled.";

type ExistingRow = {
  id: string;
  place_name?: string | null;
  city?: string | null;
  days?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  street_address?: string | null;
  zip_code?: string | null;
  status?: string | null;
};

function RowSummary({
  row,
  extra,
}: {
  row: StaffImportPreviewRow;
  extra?: string;
}) {
  const checked = row.sourceCheckedAt
    ? formatVerifiedDate(row.sourceCheckedAt)
    : null;

  return (
    <article className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
        {row.candidateId}
      </p>
      <h3 className="font-display text-xl text-[var(--ink)]">{row.placeName}</h3>
      <p className="text-sm text-[var(--muted)]">
        {row.cityLabel} {row.zipCode}
        {row.streetAddress ? ` · ${row.streetAddress}` : ""}
      </p>
      <p className="text-sm text-[var(--ink)]">
        <span className="font-medium">Public description. </span>
        {row.description}
      </p>
      <p className="text-sm text-[var(--muted)]">
        {row.typeMappingLabel} · {row.daysLabel} · {row.startTimeLabel}
      </p>
      {checked ? (
        <p className="text-sm text-[var(--muted)]">Source checked {checked}</p>
      ) : null}
      {row.needsPhoneConfirm ? (
        <p className="text-sm font-medium text-red-800">
          Phone-confirm before approval.
        </p>
      ) : null}
      {extra ? <p className="text-sm text-[var(--muted)]">{extra}</p> : null}
      {row.errors.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-red-800">
          {row.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function StaffImportPanel() {
  const [preview, setPreview] = useState<StaffImportPreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const insertLock = useRef(false);
  const previewLock = useRef(false);
  const previewAbort = useRef<AbortController | null>(null);
  const previewTimedOut = useRef(false);

  function isAbortError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const name = "name" in error ? String(error.name) : "";
    const message = "message" in error ? String(error.message) : "";
    return name === "AbortError" || /aborted|abort/i.test(message);
  }

  function cancelPreview() {
    previewAbort.current?.abort();
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setErrorMessage(null);
    setSuccessMessage(null);
    setPreview(null);
    setIncludeDuplicates(false);
    if (!file || previewLock.current || insertLock.current) return;

    const fileError = validateStaffWorkbookFile(file);
    if (fileError) {
      setFileName(file.name);
      setErrorMessage(fileError);
      return;
    }

    previewLock.current = true;
    previewTimedOut.current = false;
    const controller = new AbortController();
    previewAbort.current = controller;
    const timeoutId = window.setTimeout(() => {
      previewTimedOut.current = true;
      controller.abort();
    }, STAFF_IMPORT_PREVIEW_TIMEOUT_MS);
    setLoading(true);
    setFileName(file.name);

    const started = performance.now();
    let supabaseRequests = 0;

    try {
      const buffer = await file.arrayBuffer();
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

      const parseStarted = performance.now();
      const sheetRows = await readWorkbookSheet(buffer, IMPORT_CANDIDATES_SHEET);
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

      const mapStarted = performance.now();
      const parsed = buildStaffImportPreview(sheetRows, []);
      logDevTiming("staff-import map", {
        mapMs: Math.round(performance.now() - mapStarted),
        parseToMapMs: Math.round(performance.now() - parseStarted),
        candidateCount: uniqueStaffPreviewRows(parsed).length,
      });
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

      const filters = staffImportDuplicateFilters(parsed);
      let existing: ExistingRow[] = [];

      if (filters.cities.length > 0 && filters.zips.length > 0) {
        const fetchStarted = performance.now();
        const supabase = createSupabaseBrowserClient();
        supabaseRequests += 1;
        const { data, error } = await supabase
          .from("listings")
          .select(
            "id, place_name, city, days, start_time, end_time, description, street_address, zip_code, status",
          )
          .in("status", [...STAFF_IMPORT_DUPLICATE_STATUSES])
          .in("city", filters.cities)
          .in("zip_code", filters.zips)
          .limit(STAFF_IMPORT_DUPLICATE_FETCH_LIMIT)
          .abortSignal(controller.signal);

        logDevTiming("staff-import duplicate fetch", {
          fetchMs: Math.round(performance.now() - fetchStarted),
          supabaseRequests,
          cityCount: filters.cities.length,
          zipCount: filters.zips.length,
          existingCount: data?.length ?? 0,
        });

        if (error) {
          logDevOperationError("load listings for staff import duplicates", error);
          setErrorMessage(EXISTING_ERROR);
          return;
        }

        existing = (data ?? []) as ExistingRow[];
      }

      const compareStarted = performance.now();
      const next =
        existing.length > 0
          ? buildStaffImportPreview(sheetRows, existing)
          : parsed;
      logDevTiming("staff-import duplicate compare", {
        compareMs: Math.round(performance.now() - compareStarted),
        existingCount: existing.length,
        candidateCount: uniqueStaffPreviewRows(next).length,
      });

      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

      logDevTiming("staff-import preview", {
        totalMs: Math.round(performance.now() - started),
        supabaseRequests,
        candidateCount: uniqueStaffPreviewRows(next).length,
        renderCount:
          next.valid.length +
          next.errors.length +
          next.possibleDuplicates.length +
          next.phoneConfirm.length,
      });
      setPreview(next);
    } catch (error) {
      if (isAbortError(error)) {
        setErrorMessage(previewTimedOut.current ? TIMEOUT_ERROR : CANCELLED_ERROR);
        logDevTiming("staff-import preview aborted", {
          totalMs: Math.round(performance.now() - started),
          supabaseRequests,
          timedOut: previewTimedOut.current ? 1 : 0,
        });
        return;
      }
      logDevOperationError("preview staff workbook", error);
      setErrorMessage(
        error instanceof Error && error.message ? error.message : LOAD_ERROR,
      );
    } finally {
      window.clearTimeout(timeoutId);
      previewAbort.current = null;
      previewLock.current = false;
      setLoading(false);
    }
  }

  async function insertAccepted() {
    if (!preview || insertLock.current) return;
    insertLock.current = true;
    setErrorMessage(null);
    setSuccessMessage(null);
    setInserting(true);

    const rows = [
      ...preview.valid,
      ...(includeDuplicates
        ? preview.possibleDuplicates.filter((row) => row.insert)
        : []),
    ]
      .map((row) => row.insert)
      .filter((row): row is StaffImportInsert => row != null);

    if (rows.length === 0) {
      setErrorMessage("There are no valid rows to insert.");
      insertLock.current = false;
      setInserting(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      let inserted = 0;

      for (const row of rows) {
        const { data, error } = await supabase
          .from("listings")
          .insert(row.listing)
          .select("id")
          .maybeSingle();

        if (error || !data?.id) {
          logDevOperationError("insert staff-sourced listing", error);
          setErrorMessage(
            inserted > 0
              ? `Inserted ${inserted} listing${inserted === 1 ? "" : "s"}, then ran into an error. Remaining rows were not inserted.`
              : INSERT_ERROR,
          );
          return;
        }

        if (row.reviewNote) {
          const { error: noteError } = await supabase
            .from("listing_staff_metadata")
            .insert({
              listing_id: data.id,
              review_note: row.reviewNote,
            });

          if (noteError) {
            logDevOperationError("insert staff listing metadata", noteError);
            setErrorMessage(
              `Inserted ${inserted + 1} listing${inserted + 1 === 1 ? "" : "s"}, but a staff review note could not be saved. Remaining rows were not inserted.`,
            );
            return;
          }
        }

        inserted += 1;
      }

      setSuccessMessage(
        `Inserted ${inserted} pending staff-sourced listing${inserted === 1 ? "" : "s"}. None were approved.`,
      );
      setPreview(null);
    } catch (error) {
      logDevOperationError("insert staff-sourced listings", error);
      setErrorMessage(INSERT_ERROR);
    } finally {
      insertLock.current = false;
      setInserting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5">
        <h2 className="font-display text-2xl text-[var(--ink)]">
          Staff seed import
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Preview the workbook’s Import Candidates sheet, then insert accepted
          rows as pending staff-sourced listings. This does not approve listings,
          create contributor accounts, or award points.
        </p>
        <label className="mt-4 grid gap-2 text-sm font-medium text-[var(--ink)]">
          Excel workbook
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => void onFile(event)}
            disabled={loading || inserting}
            className="text-sm font-normal file:mr-3 file:rounded-full file:border file:border-[var(--line)] file:bg-[var(--wash)] file:px-4 file:py-2"
          />
        </label>
        {fileName ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{fileName}</p>
        ) : null}
        {loading ? (
          <button
            type="button"
            onClick={cancelPreview}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          Building import preview…
        </p>
      ) : null}

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

      {preview ? (
        <PreviewSections
          preview={preview}
          includeDuplicates={includeDuplicates}
          inserting={inserting}
          onIncludeDuplicatesChange={setIncludeDuplicates}
          onInsert={() => void insertAccepted()}
        />
      ) : null}
    </div>
  );
}

function PreviewSections({
  preview,
  includeDuplicates,
  inserting,
  onIncludeDuplicatesChange,
  onInsert,
}: {
  preview: StaffImportPreview;
  includeDuplicates: boolean;
  inserting: boolean;
  onIncludeDuplicatesChange: (value: boolean) => void;
  onInsert: () => void;
}) {
  const duplicateInserts = includeDuplicates
    ? preview.possibleDuplicates.filter((row) => row.insert).length
    : 0;
  const acceptedCount = preview.valid.length + duplicateInserts;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h3 className="font-display text-xl text-[var(--ink)]">
          Suggested listing-type mappings
        </h3>
        <ul className="grid gap-1 text-sm text-[var(--muted)]">
          {preview.typeMappings.map((mapping) => (
            <li key={mapping.workbookType}>{mapping.label}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h3 className="font-display text-xl text-[var(--ink)]">
          Validation errors ({preview.errors.length})
        </h3>
        {preview.errors.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No validation errors.</p>
        ) : (
          preview.errors.map((row) => (
            <RowSummary key={row.candidateId} row={row} />
          ))
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="font-display text-xl text-[var(--ink)]">
          Possible duplicates ({preview.possibleDuplicates.length})
        </h3>
        <p className="text-sm text-[var(--muted)]">
          Matching venue identity, title or description, days, and start/end
          times. Existing listings will not be overwritten.
        </p>
        {preview.possibleDuplicates.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No possible duplicates.</p>
        ) : (
          preview.possibleDuplicates.map((row) => (
            <RowSummary
              key={row.candidateId}
              row={row}
              extra={row.possibleDuplicates
                .map((item) => `${item.status} ${item.id}`)
                .join(", ")}
            />
          ))
        )}
        {preview.possibleDuplicates.some((row) => row.insert) ? (
          <label className="flex items-start gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={includeDuplicates}
              disabled={inserting}
              onChange={(event) =>
                onIncludeDuplicatesChange(event.target.checked)
              }
              className="mt-1"
            />
            Also insert possible duplicates as new pending rows. Do not
            overwrite existing listings.
          </label>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h3 className="font-display text-xl text-[var(--ink)]">
          Phone-confirm before approval ({preview.phoneConfirm.length})
        </h3>
        {preview.phoneConfirm.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No rows marked for phone confirmation.
          </p>
        ) : (
          preview.phoneConfirm.map((row) => (
            <RowSummary key={row.candidateId} row={row} />
          ))
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="font-display text-xl text-[var(--ink)]">
          Valid listings ({preview.valid.length})
        </h3>
        {preview.valid.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No rows are ready to insert without duplicate matches.
          </p>
        ) : (
          preview.valid.map((row) => (
            <RowSummary key={row.candidateId} row={row} />
          ))
        )}
      </section>

      <button
        type="button"
        disabled={inserting || acceptedCount === 0}
        onClick={onInsert}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
      >
        {inserting ? "Inserting…" : "Insert accepted pending staff listings"}
      </button>
      <p className="text-sm text-[var(--muted)]">
        Inserts set status to pending, is_staff_sourced to true, submitted_by
        to empty, and contributor points to zero. Review each row in Pending
        listings before approving.
      </p>
    </div>
  );
}
