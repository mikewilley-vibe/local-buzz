"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  cityFilterSummary,
  listingsHref,
  parseZipInput,
  type ParsedListingFilters,
} from "@/lib/filters";
import {
  CITIES,
  LISTING_TYPES,
  TYPE_LABELS,
  parseCityValues,
  type City,
} from "@/lib/types";

const fieldClassName =
  "w-full min-h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2";

const cityActionClassName =
  "inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2";

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
  const cityPanelId = useId();
  const cityStatusId = useId();
  const [zipError, setZipError] = useState(filters.zipError);
  const selectedCities = filters.cities;
  const hasActiveFilters = Boolean(
    selectedCities.length ||
      filters.type ||
      filters.zip ||
      filters.zipInput ||
      filters.day,
  );
  const clearHref = listingsHref(
    { view: filters.view },
    { submitted },
  );

  function filtersFromForm(form: HTMLFormElement) {
    const data = new FormData(form);
    const zipState = parseZipInput(String(data.get("zip") ?? ""));
    const cities = parseCityValues(
      data.getAll("city").map((value) => String(value)),
    );

    return {
      cities,
      type: String(data.get("type") ?? ""),
      zip: zipState.zip ?? (zipState.zipInput ? filters.zip : undefined),
      zipState,
    };
  }

  function navigateWith(next: {
    cities?: City[];
    type?: string;
    zip?: string;
  }) {
    router.push(
      listingsHref(
        {
          cities: next.cities ?? selectedCities,
          type: next.type,
          zip: next.zip,
          day: filters.day,
          view: filters.view,
        },
        { submitted },
      ),
      { scroll: false },
    );
  }

  function onFormChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === "zip") {
      return;
    }

    const next = filtersFromForm(event.currentTarget);
    if (next.zipState.zipError) {
      setZipError(next.zipState.zipError);
    } else {
      setZipError(null);
    }
    navigateWith({
      cities: next.cities,
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
      cities: next.cities,
      type: next.type,
      zip: next.zipState.zip,
    });
  }

  function onCityKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.currentTarget.open = false;
      const summary = event.currentTarget.querySelector("summary");
      summary?.focus();
    }
  }

  const describedBy = zipError
    ? `${zipHintId} ${zipErrorId}`
    : zipHintId;

  const cityStatus =
    selectedCities.length === 0
      ? "Showing listings for all cities."
      : selectedCities.length === 1
        ? `Showing listings for ${selectedCities[0]}.`
        : `Showing listings for ${selectedCities.length} cities.`;

  return (
    <form
      key={`${filters.type ?? ""}:${filters.zip ?? ""}:${filters.zipInput}:${filters.day ?? ""}:${filters.view ?? ""}`}
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
      {filters.day ? (
        <input type="hidden" name="day" value={filters.day} />
      ) : null}
      {filters.view ? (
        <input type="hidden" name="view" value={filters.view} />
      ) : null}

      <div className="grid min-w-[14rem] flex-1 gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]" id={`${cityPanelId}-label`}>
          Cities
        </span>
        <div className="flex flex-wrap gap-2">
          <Link
            href={listingsHref(
              {
                type: filters.type,
                zip: filters.zip,
                day: filters.day,
                view: filters.view,
              },
              { submitted },
            )}
            scroll={false}
            className={cityActionClassName}
          >
            All cities
          </Link>
          <Link
            href={listingsHref(
              {
                type: filters.type,
                zip: filters.zip,
                day: filters.day,
                view: filters.view,
              },
              { submitted },
            )}
            scroll={false}
            className={cityActionClassName}
          >
            Clear city selections
          </Link>
        </div>
        <details
          className="group rounded-xl border border-[var(--line)] bg-[var(--paper)]"
          onKeyDown={onCityKeyDown}
        >
          <summary
            aria-controls={cityPanelId}
            aria-describedby={cityStatusId}
            className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] marker:content-none [&::-webkit-details-marker]:hidden focus-visible:ring-2"
          >
            <span>
              <span className="sr-only">Cities, </span>
              {cityFilterSummary(selectedCities)}
            </span>
            <span className="text-sm text-[var(--muted)] group-open:hidden" aria-hidden="true">
              Show
            </span>
            <span className="hidden text-sm text-[var(--muted)] group-open:inline" aria-hidden="true">
              Hide
            </span>
          </summary>
          <div
            id={cityPanelId}
            role="group"
            aria-labelledby={`${cityPanelId}-label`}
            className="grid gap-2 border-t border-[var(--line)] p-3"
          >
            <ul key={selectedCities.join("|")} className="grid gap-1">
              {CITIES.map((city) => (
                <li key={city}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 outline-none hover:bg-[var(--wash)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--amber)]">
                    <input
                      type="checkbox"
                      name="city"
                      value={city}
                      defaultChecked={selectedCities.includes(city)}
                      className="size-4 shrink-0 accent-[var(--amber-deep)] outline-none"
                    />
                    <span className="text-sm text-[var(--ink)]">{city}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </details>
        <p id={cityStatusId} className="sr-only" aria-live="polite">
          {cityStatus}
        </p>
      </div>

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
