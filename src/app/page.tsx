import { WeekCalendar } from "@/components/WeekCalendar";
import { getListings } from "@/lib/listings";
import { getThisWeek } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ submitted }, listings] = await Promise.all([
    searchParams,
    getListings(),
  ]);
  const week = getThisWeek();

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

      {submitted === "1" ? (
        <p
          className="rounded-2xl border border-[var(--amber)] bg-[var(--wash)] px-4 py-3 text-sm text-[var(--ink)]"
          role="status"
        >
          Submitted for review. It will show up here after it is approved.
        </p>
      ) : null}

      <WeekCalendar week={week} listings={listings} />
    </div>
  );
}
