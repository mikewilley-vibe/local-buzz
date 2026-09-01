import type { Listing } from "@/lib/types";
import type { WeekDay } from "@/lib/week";
import { ListingCard } from "./ListingCard";

export function WeekCalendar({
  week,
  listings,
}: {
  week: WeekDay[];
  listings: Listing[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
      <div className="grid min-w-[56rem] grid-cols-7">
        {week.map((day, index) => {
          const dayListings = listings.filter((listing) =>
            listing.days.includes(day.key),
          );

          return (
            <section
              key={day.key}
              id={day.key}
              className={`flex min-h-[28rem] flex-col ${
                index === 0 ? "" : "border-l border-[var(--line)]"
              } ${day.isToday ? "bg-[var(--wash)]" : ""}`}
            >
              <header
                className={`border-b border-[var(--line)] px-2 py-3 text-center ${
                  day.isToday ? "bg-[var(--amber)]" : "bg-[var(--paper)]"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink)]">
                  {day.label.slice(0, 3)}
                </p>
                <p className="font-display text-2xl leading-none text-[var(--ink)]">
                  {day.dayNumber}
                </p>
                {day.isToday ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink)]">
                    Today
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    {day.dateLabel}
                  </p>
                )}
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
