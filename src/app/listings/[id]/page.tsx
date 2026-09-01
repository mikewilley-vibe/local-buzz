import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovedListing } from "@/lib/listings";
import { DAY_LABELS, TYPE_LABELS } from "@/lib/types";
import { formatTimeRange } from "@/lib/week";

export const dynamic = "force-dynamic";

function formatVerifiedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(date);
}

function confirmationLabel(count: number) {
  if (count === 1) return "1 confirmation";
  return `${count} confirmations`;
}

export async function generateMetadata({
  params,
}: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const listing = await getApprovedListing(id);

  if (!listing) {
    return { title: "Listing not found — Local Buzz" };
  }

  return {
    title: `${listing.placeName} — Local Buzz`,
    description: `${TYPE_LABELS[listing.type]} in ${listing.city}. ${listing.description}`,
  };
}

export default async function ListingDetailPage({
  params,
}: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const listing = await getApprovedListing(id);

  if (!listing) {
    notFound();
  }

  const time = formatTimeRange(listing.startTime, listing.endTime);
  const verified = listing.lastVerifiedAt
    ? formatVerifiedDate(listing.lastVerifiedAt)
    : null;
  const days = listing.days.map((day) => DAY_LABELS[day]).join(", ");

  return (
    <article className="mx-auto grid max-w-xl gap-6">
      <p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--amber-deep)] hover:underline"
        >
          Back to this week
        </Link>
      </p>

      <header>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          {TYPE_LABELS[listing.type]}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-[var(--ink)]">
          {listing.placeName}
        </h1>
        <p className="mt-2 text-[var(--muted)]">{listing.city}</p>
      </header>

      <p className="text-base leading-relaxed text-[var(--ink)]">
        {listing.description}
      </p>

      <dl className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5">
        <div>
          <dt className="text-sm font-medium text-[var(--ink)]">Days</dt>
          <dd className="mt-1 text-sm text-[var(--muted)]">{days}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--ink)]">Time</dt>
          <dd className="mt-1 text-sm text-[var(--muted)]">
            {time || "Time not listed"}
          </dd>
        </div>
        {listing.sourceUrl ? (
          <div>
            <dt className="text-sm font-medium text-[var(--ink)]">Source</dt>
            <dd className="mt-1 text-sm">
              <a
                href={listing.sourceUrl}
                className="break-all text-[var(--amber-deep)] underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                {listing.sourceUrl}
              </a>
            </dd>
          </div>
        ) : null}
        {verified ? (
          <div>
            <dt className="text-sm font-medium text-[var(--ink)]">
              Last verified
            </dt>
            <dd className="mt-1 text-sm text-[var(--muted)]">{verified}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-sm font-medium text-[var(--ink)]">
            Confirmations
          </dt>
          <dd className="mt-1 text-sm text-[var(--muted)]">
            {confirmationLabel(listing.confirmationCount)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
