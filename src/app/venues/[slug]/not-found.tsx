import Link from "next/link";

export default function VenueNotFound() {
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h1 className="font-display text-4xl text-[var(--ink)]">
        Venue not found
      </h1>
      <p className="text-[var(--muted)]">
        This venue isn’t on the public calendar. It may have no approved
        listings yet, or the link may be out of date.
      </p>
      <p>
        <Link
          href="/venues"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--amber-deep)] outline-none ring-[var(--amber)] hover:underline focus-visible:ring-2"
        >
          Back to venues
        </Link>
      </p>
    </div>
  );
}
