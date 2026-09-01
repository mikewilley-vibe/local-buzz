"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { listingsHref } from "@/lib/filters";
import { CITIES, LISTING_TYPES, TYPE_LABELS, type ListingFilters } from "@/lib/types";

const selectClassName =
  "w-full min-h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2";

export function ListingFiltersBar({
  filters,
  submitted,
}: {
  filters: ListingFilters;
  submitted: boolean;
}) {
  const router = useRouter();
  const hasActiveFilters = Boolean(filters.city || filters.type);
  const clearHref = listingsHref({}, { submitted });

  function navigateFromForm(form: HTMLFormElement) {
    const data = new FormData(form);
    router.push(
      listingsHref(
        {
          city: String(data.get("city") ?? ""),
          type: String(data.get("type") ?? ""),
        },
        { submitted },
      ),
      { scroll: false },
    );
  }

  return (
    <form
      key={`${filters.city ?? ""}:${filters.type ?? ""}`}
      action="/"
      method="get"
      className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 sm:flex-row sm:flex-wrap sm:items-end"
      onChange={(event) => {
        navigateFromForm(event.currentTarget);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        navigateFromForm(event.currentTarget);
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
          className={selectClassName}
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
          className={selectClassName}
        >
          <option value="">All types</option>
          {LISTING_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
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
            className="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--wash)]"
          >
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
