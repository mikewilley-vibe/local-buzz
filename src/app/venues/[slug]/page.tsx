import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectionsLink } from "@/components/DirectionsLink";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { TYPE_LABELS } from "@/lib/types";
import { getApprovedVenueBySlug, groupVenueListingsByDay } from "@/lib/venues";
import { formatTimeRange } from "@/lib/week";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({
  params,
}: PageProps<"/venues/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getApprovedVenueBySlug(slug);

  if (!venue) {
    return { title: "Venue not found — Local Buzz" };
  }

  const listingLabel =
    venue.listings.length === 1
      ? "1 current listing"
      : `${venue.listings.length} current listings`;

  return {
    title: `${venue.name} — Local Buzz`,
    description: `${venue.name} in ${venue.location.city ?? "Hampton Roads"}. ${listingLabel} on the Local Buzz calendar.`,
  };
}

export default async function VenuePage({
  params,
}: PageProps<"/venues/[slug]">) {
  const { slug } = await params;
  const venue = await getApprovedVenueBySlug(slug);

  if (!venue || venue.listings.length === 0) {
    notFound();
  }

  const dayGroups = groupVenueListingsByDay(venue.listings).filter(
    (group) => group.listings.length > 0,
  );

  return (
    <div className="mx-auto grid max-w-xl gap-8">
      <p>
        <Link
          href="/venues"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--amber-deep)] outline-none ring-[var(--amber)] hover:underline focus-visible:ring-2"
        >
          Back to venues
        </Link>
      </p>

      <header>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          Venue
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-[var(--ink)]">
          {venue.name}
        </h1>
        {venue.addressLabel ? (
          <p className="mt-2 text-[var(--muted)]">{venue.addressLabel}</p>
        ) : (
          <p className="mt-2 text-[var(--muted)]">{venue.location.city}</p>
        )}
        {venue.location.streetAddress ? (
          <div className="mt-1">
            <DirectionsLink location={venue.location} />
          </div>
        ) : null}
      </header>

      <div className="grid gap-6">
        {dayGroups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`venue-day-${group.key}`}
            className="grid gap-2"
          >
            <h2
              id={`venue-day-${group.key}`}
              className="font-display text-2xl text-[var(--ink)]"
            >
              {group.label}
            </h2>
            <ul className="grid gap-2">
              {group.listings.map((listing) => {
                const time = formatTimeRange(listing.startTime, listing.endTime);

                return (
                  <li key={`${listing.id}-${group.key}`}>
                    <Link
                      href={`/listings/${listing.id}`}
                      className="block rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
                        {TYPE_LABELS[listing.type]}
                      </p>
                      <h3 className="mt-1 font-display text-lg leading-snug text-[var(--ink)]">
                        {listing.description}
                      </h3>
                      {time ? (
                        <p className="mt-1 text-sm text-[var(--muted)]">{time}</p>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Time not listed
                        </p>
                      )}
                      <div className="mt-2">
                        <FreshnessBadge lastVerifiedAt={listing.lastVerifiedAt} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
