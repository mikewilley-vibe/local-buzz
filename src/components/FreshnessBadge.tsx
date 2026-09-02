import {
  classifyListingFreshness,
  FRESHNESS_LABELS,
  type Freshness,
} from "@/lib/freshness";

const BADGE_CLASS: Record<Freshness, string> = {
  recent:
    "border-emerald-800/25 bg-emerald-50 text-emerald-950",
  aging: "border-[var(--amber)] bg-[var(--wash)] text-[var(--amber-deep)]",
  stale: "border-red-300 bg-red-50 text-red-950",
  unverified: "border-[var(--line)] bg-[var(--background)] text-[var(--ink)]",
};

export function FreshnessBadge({
  lastVerifiedAt,
  compact = false,
}: {
  lastVerifiedAt: string | null;
  compact?: boolean;
}) {
  const freshness = classifyListingFreshness(lastVerifiedAt);
  const label = FRESHNESS_LABELS[freshness];

  return (
    <p
      className={`inline-flex max-w-full rounded-full border font-medium ${
        compact
          ? "mt-1 px-1.5 py-0.5 text-[10px] leading-tight"
          : "px-2.5 py-1 text-xs"
      } ${BADGE_CLASS[freshness]}`}
    >
      {label}
    </p>
  );
}
