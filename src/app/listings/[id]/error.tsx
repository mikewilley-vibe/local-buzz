"use client";

import Link from "next/link";

export default function ListingError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h1 className="font-display text-4xl text-[var(--ink)]">
        Couldn’t load this listing
      </h1>
      <p className="text-[var(--muted)]">
        Something went wrong while loading this page. Try again, or go back to
        this week’s calendar.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--amber-hover)]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--amber-deep)] hover:underline"
        >
          Back to this week
        </Link>
      </div>
    </div>
  );
}
