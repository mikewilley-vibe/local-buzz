import Link from "next/link";

export default function ListingNotFound() {
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h1 className="font-display text-4xl text-[var(--ink)]">
        Listing not found
      </h1>
      <p className="text-[var(--muted)]">
        This listing isn’t on the public calendar. It may be pending review,
        outdated, or no longer available.
      </p>
      <p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--amber-deep)] hover:underline"
        >
          Back to this week
        </Link>
      </p>
    </div>
  );
}
