"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listingsHref, parseZipInput, type ParsedListingFilters } from "@/lib/filters";
import { CITIES, LISTING_TYPES, TYPE_LABELS } from "@/lib/types";

const fieldClassName =
  "w-full min-h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2";

export function ListingFiltersBar({
  filters,
  submitted,
}: {
  filters: ParsedListingFilters;
  submitted: boolean;
}) {
  const router = useRouter();
  const zipHintId = useId();
  const zipErrorId = useId();
  const [zipError, setZipError] = useState(filters.zipError);
  const hasActiveFilters = Boolean(
    filters.city || filters.type || filters.zip || filters.zipInput,
  );
  const clearHref = listingsHref({}, { submitted });

  function filtersFromForm(form: HTMLFormElement) {
    const data = new FormData(form);
    const zipState = parseZipInput(String(data.get("zip") ?? ""));

    return {
      city: String(data.get("city") ?? ""),
      type: String(data.get("type") ?? ""),
      zip: zipState.zip ?? (zipState.zipInput ? filters.zip : undefined),
      zipState,
    };
  }

  function navigateWith(next: { city?: string; type?: string; zip?: string }) {
    router.push(listingsHref(next, { submitted }), { scroll: false });
  }

  function onFormChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.name === "zip"
    ) {
      return;
    }

    const next = filtersFromForm(event.currentTarget);
    if (next.zipState.zipError) {
      setZipError(next.zipState.zipError);
    } else {
      setZipError(null);
    }
    navigateWith({
      city: next.city,
      type: next.type,
      zip: next.zip,
    });
  }

  function applyZipFromForm(form: HTMLFormElement) {
    const next = filtersFromForm(form);
    if (next.zipState.zipError) {
      setZipError(next.zipState.zipError);
      return;
    }

    setZipError(null);
    navigateWith({
      city: next.city,
      type: next.type,
      zip: next.zipState.zip,
    });
  }

  const describedBy = zipError
    ? `${zipHintId} ${zipErrorId}`
    : zipHintId;

  return (
    <form
      key={`${filters.city ?? ""}:${filters.type ?? ""}:${filters.zip ?? ""}:${filters.zipInput}`}
      action="/"
      method="get"
      className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 sm:flex-row sm:flex-wrap sm:items-start"
      onChange={onFormChange}
      onSubmit={(event) => {
        event.preventDefault();
        applyZipFromForm(event.currentTarget);
      }}
    >
      {submitted ? (
        <input type="hidden" name="submitted" value="1" />
      ) : null}

      <label className="grid min-w-[10rem] flex-1 gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">City</span>
        <select
          name="city"
          defaultValue={filters.city ?? ""}
          className={fieldClassName}
        >
          <option value="">All Hampton Roads</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <label className="grid min-w-[10rem] flex-1 gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">Event type</span>
        <select
          name="type"
          defaultValue={filters.type ?? ""}
          className={fieldClassName}
        >
          <option value="">All types</option>
          {LISTING_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid min-w-[10rem] flex-1 gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">ZIP code</span>
        <input
          type="text"
          name="zip"
          defaultValue={filters.zipInput}
          inputMode="numeric"
          autoComplete="postal-code"
          enterKeyHint="search"
          maxLength={10}
          spellCheck={false}
          aria-invalid={zipError ? true : undefined}
          aria-describedby={describedBy}
          placeholder="23510"
          onBlur={(event) => {
            const form = event.currentTarget.form;
            if (form) applyZipFromForm(form);
          }}
          className={fieldClassName}
        />
        <span id={zipHintId} className="text-sm text-[var(--muted)]">
          Optional. 5-digit or ZIP+4.
        </span>
        {zipError ? (
          <span id={zipErrorId} className="text-sm text-red-800" role="alert">
            {zipError}
          </span>
        ) : null}
      </label>

      <div className="flex items-center gap-2">
        <noscript>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--amber-hover)]"
          >
            Apply filters
          </button>
        </noscript>
        {hasActiveFilters ? (
          <Link
            href={clearHref}
            scroll={false}
            className="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
          >
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
