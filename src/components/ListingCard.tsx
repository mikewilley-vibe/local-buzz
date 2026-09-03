import Link from "next/link";
import { TYPE_LABELS, type Listing } from "@/lib/types";
import { formatCityWithZip } from "@/lib/location";
import { venueSlugFromListing } from "@/lib/venues";
import { listingScheduleLabel } from "@/lib/week";
import { FreshnessBadge } from "./FreshnessBadge";

export function ListingCard({
  listing,
  compact = false,
}: {
  listing: Listing;
  compact?: boolean;
}) {
  const time = listingScheduleLabel(
    listing.startTime,
    listing.endTime,
    listing.description,
  );
  const href = `/listings/${listing.id}`;
  const venueHref = `/venues/${venueSlugFromListing(listing)}`;
  const cityLine = listing.city
    ? formatCityWithZip(listing.city, listing.zipCode)
    : listing.zipCode?.trim() || "";
  const venueLabel = `View venue for ${listing.placeName}`;

  if (compact) {
    return (
      <article className="rounded-lg border border-[var(--line)] bg-[var(--paper)]">
        <Link
          href={href}
          className="block p-2 outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--amber-deep)]">
            {TYPE_LABELS[listing.type]}
          </p>
          <h3 className="mt-0.5 font-display text-sm leading-snug text-[var(--ink)]">
            {listing.placeName}
          </h3>
          <p className="text-[11px] leading-snug text-[var(--muted)]">
            {cityLine}
            {time ? ` · ${time}` : ""}
          </p>
          <FreshnessBadge lastVerifiedAt={listing.lastVerifiedAt} compact />
        </Link>
        <p className="border-t border-[var(--line)] px-2 py-1">
          <Link
            href={venueHref}
            aria-label={venueLabel}
            className="text-[10px] font-medium text-[var(--amber-deep)] outline-none ring-[var(--amber)] hover:underline focus-visible:ring-2"
          >
            View venue
          </Link>
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-[0_1px_0_rgba(28,25,23,0.04)]">
      <Link
        href={href}
        className="block p-4 outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
          {TYPE_LABELS[listing.type]}
        </p>
        <h3 className="mt-1 font-display text-lg leading-snug text-[var(--ink)]">
          {listing.placeName}
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {cityLine}
          {time ? ` · ${time}` : ""}
        </p>
        <div className="mt-2">
          <FreshnessBadge lastVerifiedAt={listing.lastVerifiedAt} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
          {listing.description}
        </p>
      </Link>
      <p className="border-t border-[var(--line)] px-4 py-2">
        <Link
          href={venueHref}
          aria-label={venueLabel}
          className="text-sm font-medium text-[var(--amber-deep)] outline-none ring-[var(--amber)] hover:underline focus-visible:ring-2"
        >
          View venue
        </Link>
      </p>
    </article>
  );
}
