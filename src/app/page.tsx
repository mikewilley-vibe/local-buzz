import { AgendaCalendar } from "@/components/AgendaCalendar";
import { CalendarToolbar } from "@/components/CalendarToolbar";
import { ListingFiltersBar } from "@/components/ListingFilters";
import { WeekCalendar } from "@/components/WeekCalendar";
import {
  formatSelectedArea,
  hasSubmittedConfirmation,
  parseListingFilters,
} from "@/lib/filters";
import { getListings } from "@/lib/listings";
import { DAY_LABELS } from "@/lib/types";
import { easternTodayDay, getThisWeek } from "@/lib/week";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const submitted = hasSubmittedConfirmation(params);
  const filters = parseListingFilters(params);
  const listings = await getListings({
    cities: filters.cities,
    type: filters.type,
    zip: filters.zip,
  });
  const week = getThisWeek();
  const selectedDay = filters.day;
  const visibleDays = selectedDay
    ? week.filter((day) => day.key === selectedDay)
    : week;
  const visibleListings = selectedDay
    ? listings.filter((listing) => listing.days.includes(selectedDay))
    : listings;
  const count = visibleListings.length;
  const areaLabel = formatSelectedArea(filters.cities);
  const listingCountLabel = selectedDay
    ? count === 1
      ? `1 listing for ${DAY_LABELS[selectedDay]}`
      : `${count} listings for ${DAY_LABELS[selectedDay]}`
    : count === 1
      ? "1 listing this week"
      : `${count} listings this week`;

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
        <CalendarToolbar
          filters={filters}
          submitted={submitted}
          today={easternTodayDay()}
        />
        <div className="grid gap-1">
          <p className="text-sm text-[var(--muted)]">{listingCountLabel}</p>
          <p className="text-sm text-[var(--ink)]">Area: {areaLabel}</p>
          {visibleListings.length > 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Repeating listings count once, even if they appear under more than
              one day.
            </p>
          ) : null}
        </div>
      </div>

      {listings.length === 0 ? (
        <div
          className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-8 text-center"
          role="status"
        >
          <p className="font-display text-xl text-[var(--ink)]">
            No listings match the active filters.
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
      ) : visibleListings.length === 0 ? (
        <div
          className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-8 text-center"
          role="status"
        >
          <p className="font-display text-xl text-[var(--ink)]">
            No listings for the selected day.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            These are weekly recurring listings. Try All week or another day.
          </p>
        </div>
      ) : filters.view === "week" ? (
        <WeekCalendar week={visibleDays} listings={listings} />
      ) : filters.view === "agenda" ? (
        <AgendaCalendar week={visibleDays} listings={listings} />
      ) : (
        <>
          <div className="md:hidden">
            <AgendaCalendar week={visibleDays} listings={listings} />
          </div>
          <div className="hidden md:block">
            <WeekCalendar week={visibleDays} listings={listings} />
          </div>
        </>
      )}
    </div>
  );
}
