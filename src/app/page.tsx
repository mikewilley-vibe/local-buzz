import { ListingFiltersBar } from "@/components/ListingFilters";
import { WeekCalendar } from "@/components/WeekCalendar";
import { hasSubmittedConfirmation, parseListingFilters } from "@/lib/filters";
import { getListings } from "@/lib/listings";
import { getThisWeek } from "@/lib/week";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const submitted = hasSubmittedConfirmation(params);
  const filters = parseListingFilters(params);
  const listings = await getListings(filters);
  const week = getThisWeek();
  const listingCountLabel =
    listings.length === 1 ? "1 listing this week" : `${listings.length} listings this week`;

  return (
    <div className="grid gap-8">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          Version 1 · Hampton Roads
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
          What’s going on this week?
        </h1>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Happy hours, food specials, trivia, bingo, and live music around
          Norfolk, Virginia Beach, and the rest of Hampton Roads. Community
          submissions are reviewed before they appear on this calendar.
        </p>
      </div>

      {submitted ? (
        <p
          className="rounded-2xl border border-[var(--amber)] bg-[var(--wash)] px-4 py-3 text-sm text-[var(--ink)]"
          role="status"
        >
          Submitted for review. It will show up here after it is approved.
        </p>
      ) : null}

      <div className="grid gap-3">
        <ListingFiltersBar filters={filters} submitted={submitted} />
        <p className="text-sm text-[var(--muted)]">{listingCountLabel}</p>
      </div>

      {listings.length === 0 ? (
        <div
          className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-8 text-center"
          role="status"
        >
          <p className="font-display text-xl text-[var(--ink)]">
            No buzz found for these filters yet.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Know a special or event that belongs here?
          </p>
          <Link
            href="/add"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--amber-hover)]"
          >
            Add a listing
          </Link>
        </div>
      ) : (
        <WeekCalendar week={week} listings={listings} />
      )}
    </div>
  );
}
