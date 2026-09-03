import Link from "next/link";
import { listingsHref, type ParsedListingFilters } from "@/lib/filters";
import { DAYS, DAY_LABELS, type DayOfWeek } from "@/lib/types";

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
}: {
  filters: ParsedListingFilters;
  submitted: boolean;
  today: DayOfWeek;
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
          {DAYS.map((day) => (
            <Link
              key={day}
              href={dayHref(day)}
              scroll={false}
              aria-label={DAY_LABELS[day]}
              aria-current={filters.day === day ? "page" : undefined}
              className={chipState(filters.day === day)}
            >
              {DAY_LABELS[day].slice(0, 3)}
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
