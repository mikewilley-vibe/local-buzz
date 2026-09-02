import Link from "next/link";
import { TYPE_LABELS, type Listing } from "@/lib/types";
import { formatTimeRange } from "@/lib/week";
import { FreshnessBadge } from "./FreshnessBadge";

export function ListingCard({
  listing,
  compact = false,
}: {
  listing: Listing;
  compact?: boolean;
}) {
  const time = formatTimeRange(listing.startTime, listing.endTime);
  const href = `/listings/${listing.id}`;

  if (compact) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-[var(--line)] bg-[var(--paper)] p-2 outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
      >
        <article>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--amber-deep)]">
            {TYPE_LABELS[listing.type]}
          </p>
          <h3 className="mt-0.5 font-display text-sm leading-snug text-[var(--ink)]">
            {listing.placeName}
          </h3>
          <p className="text-[11px] leading-snug text-[var(--muted)]">
            {listing.city}
            {time ? ` · ${time}` : ""}
          </p>
          <FreshnessBadge lastVerifiedAt={listing.lastVerifiedAt} compact />
        </article>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-[0_1px_0_rgba(28,25,23,0.04)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
    >
      <article>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
          {TYPE_LABELS[listing.type]}
        </p>
        <h3 className="mt-1 font-display text-lg leading-snug text-[var(--ink)]">
          {listing.placeName}
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {listing.city}
          {time ? ` · ${time}` : ""}
        </p>
        <div className="mt-2">
          <FreshnessBadge lastVerifiedAt={listing.lastVerifiedAt} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
          {listing.description}
        </p>
      </article>
    </Link>
  );
}
