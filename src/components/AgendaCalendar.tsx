import type { Listing } from "@/lib/types";
import { compareListingsByStartTime, type WeekDay } from "@/lib/week";
import { ListingCard } from "./ListingCard";

export function AgendaCalendar({
  week,
  listings,
}: {
  week: WeekDay[];
  listings: Listing[];
}) {
  return (
    <div className="grid gap-6">
      {week.map((day) => {
        const dayListings = listings
          .filter((listing) => listing.days.includes(day.key))
          .slice()
          .sort(compareListingsByStartTime);

        return (
          <section
            key={day.key}
            aria-labelledby={`agenda-${day.key}`}
            className={`rounded-2xl border border-[var(--line)] bg-[var(--paper)] ${
              day.isToday ? "bg-[var(--wash)]" : ""
            }`}
          >
            <header
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--line)] px-4 py-3 ${
                day.isToday ? "bg-[var(--amber)]" : ""
              }`}
            >
              <h2
                id={`agenda-${day.key}`}
                className="font-display text-2xl leading-tight text-[var(--ink)]"
              >
                {day.headingDate}
              </h2>
              {day.isToday ? (
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ink)]">
                  Today
                </p>
              ) : null}
            </header>

            <div className="grid gap-3 p-3 sm:p-4">
              {dayListings.length === 0 ? (
                <p className="px-1 py-4 text-sm text-[var(--muted)]">
                  No listings this day.
                </p>
              ) : (
                dayListings.map((listing) => (
                  <ListingCard
                    key={`${listing.id}-${day.key}`}
                    listing={listing}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
