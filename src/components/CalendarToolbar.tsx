import Link from "next/link";
import { listingsHref, type ParsedListingFilters } from "@/lib/filters";
import type { DayOfWeek } from "@/lib/types";
import type { WeekDay } from "@/lib/week";

const chipClassName =
  "inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm outline-none ring-[var(--amber)] focus-visible:ring-2";

function chipState(active: boolean) {
  return active
    ? `${chipClassName} bg-[var(--amber)] font-medium text-[var(--ink)]`
    : `${chipClassName} text-[var(--ink)] hover:bg-[var(--wash)]`;
}

export function CalendarToolbar({
  filters,
  submitted,
  today,
  week,
}: {
  filters: ParsedListingFilters;
  submitted: boolean;
  today: DayOfWeek;
  week: WeekDay[];
}) {
  const base = {
    cities: filters.cities,
    type: filters.type,
    zip: filters.zip,
    view: filters.view,
  };

  function dayHref(day?: DayOfWeek) {
    return listingsHref({ ...base, day }, { submitted });
  }

  function viewHref(view: "week" | "agenda") {
    return listingsHref(
      { ...base, day: filters.day, view },
      { submitted },
    );
  }

  const weekForced = filters.view === "week";
  const agendaForced = filters.view === "agenda";
  const responsiveDefault = !filters.view;

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-[var(--ink)]">Day</p>
        <nav aria-label="Select a day" className="flex flex-wrap gap-2">
          <Link
            href={dayHref(undefined)}
            scroll={false}
            aria-current={!filters.day ? "page" : undefined}
            className={chipState(!filters.day)}
          >
            All week
          </Link>
          <Link
            href={dayHref(today)}
            scroll={false}
            aria-current={filters.day === today ? "page" : undefined}
            className={chipState(filters.day === today)}
          >
            Today
          </Link>
          {week.map((day) => (
            <Link
              key={`${day.key}-${day.dayNumber}`}
              href={dayHref(day.key)}
              scroll={false}
              aria-label={day.headingDate}
              aria-current={filters.day === day.key ? "page" : undefined}
              className={chipState(filters.day === day.key)}
            >
              {day.label.slice(0, 3)} {day.dayNumber}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-[var(--ink)]">View</p>
        <nav aria-label="Calendar view" className="flex flex-wrap gap-2">
          <Link
            href={viewHref("week")}
            scroll={false}
            aria-current={weekForced ? "page" : undefined}
            className={`${chipState(weekForced)} ${
              responsiveDefault
                ? "max-md:bg-transparent max-md:font-normal md:bg-[var(--amber)] md:font-medium"
                : ""
            }`}
          >
            Week
          </Link>
          <Link
            href={viewHref("agenda")}
            scroll={false}
            aria-current={agendaForced ? "page" : undefined}
            className={`${chipState(agendaForced)} ${
              responsiveDefault
                ? "bg-[var(--amber)] font-medium md:bg-transparent md:font-normal md:hover:bg-[var(--wash)]"
                : ""
            }`}
          >
            Agenda
          </Link>
        </nav>
      </div>
    </div>
  );
}
