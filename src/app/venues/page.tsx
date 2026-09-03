import type { Metadata } from "next";
import Link from "next/link";
import { getApprovedVenueDirectory } from "@/lib/venues";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Venues — Local Buzz",
  description:
    "Approved Hampton Roads bars and restaurants with current Local Buzz listings.",
};

export default async function VenuesPage() {
  const venues = await getApprovedVenueDirectory();
  const countLabel =
    venues.length === 1 ? "1 venue" : `${venues.length} venues`;

  return (
    <div className="grid gap-8">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          Hampton Roads
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
          Venues
        </h1>
        <p className="mt-3 max-w-xl text-[var(--muted)]">
          Places with approved listings this week, grouped from public calendar
          details.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">{countLabel}</p>
      </div>

      {venues.length === 0 ? (
        <p
          className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-8 text-center text-[var(--muted)]"
          role="status"
        >
          No approved venues yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {venues.map((venue) => {
            const listingLabel =
              venue.listingCount === 1
                ? "1 listing"
                : `${venue.listingCount} listings`;

            return (
              <li key={venue.slug}>
                <Link
                  href={`/venues/${venue.slug}`}
                  className="block rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
                >
                  <h2 className="font-display text-xl leading-snug text-[var(--ink)]">
                    {venue.name}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {venue.city}
                    <span aria-hidden="true"> · </span>
                    {listingLabel}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
