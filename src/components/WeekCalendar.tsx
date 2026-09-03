import type { Listing } from "@/lib/types";
import { compareListingsByStartTime, type WeekDay } from "@/lib/week";
import { ListingCard } from "./ListingCard";

export function WeekCalendar({
  week,
  listings,
}: {
  week: WeekDay[];
  listings: Listing[];
}) {
  const singleDay = week.length === 1;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
      <div
        className={
          singleDay
            ? "grid grid-cols-1"
            : "grid min-w-[56rem] grid-cols-7"
        }
      >
        {week.map((day, index) => {
          const dayListings = listings
            .filter((listing) => listing.days.includes(day.key))
            .slice()
            .sort(compareListingsByStartTime);

          return (
            <section
              key={day.key}
              aria-labelledby={`week-${day.key}`}
              className={`flex min-h-[28rem] flex-col ${
                index === 0 ? "" : "border-l border-[var(--line)]"
              } ${day.isToday ? "bg-[var(--wash)]" : ""}`}
            >
              <header
                className={`border-b border-[var(--line)] px-2 py-3 text-center ${
                  day.isToday ? "bg-[var(--amber)]" : "bg-[var(--paper)]"
                }`}
              >
                <h2
                  id={`week-${day.key}`}
                  className="font-display text-base leading-tight text-[var(--ink)] sm:text-lg"
                >
                  {day.headingDate}
                </h2>
                {day.isToday ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink)]">
                    Today
                  </p>
                ) : null}
              </header>

              <div className="flex flex-1 flex-col gap-2 p-2">
                {dayListings.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-[var(--muted)]">
                    —
                  </p>
                ) : (
                  dayListings.map((listing) => (
                    <ListingCard
                      key={`${listing.id}-${day.key}`}
                      listing={listing}
                      compact
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
