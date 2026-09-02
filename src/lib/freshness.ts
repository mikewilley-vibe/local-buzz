import { easternCalendarUtc } from "./week";

export const FRESHNESS_STATES = [
  "recent",
  "aging",
  "stale",
  "unverified",
] as const;

export type Freshness = (typeof FRESHNESS_STATES)[number];

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  recent: "Recently verified",
  aging: "Verification getting old",
  stale: "Needs verification",
  unverified: "Not yet verified",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysSinceVerified(
  lastVerifiedAt: string,
  now = new Date(),
) {
  const verified = new Date(lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) return null;

  return Math.floor(
    (easternCalendarUtc(now) - easternCalendarUtc(verified)) / MS_PER_DAY,
  );
}

export function classifyListingFreshness(
  lastVerifiedAt: string | null | undefined,
  now = new Date(),
): Freshness {
  if (!lastVerifiedAt) return "unverified";

  const days = daysSinceVerified(lastVerifiedAt, now);
  if (days === null) return "unverified";
  if (days <= 30) return "recent";
  if (days <= 90) return "aging";
  return "stale";
}

export function needsVerification(freshness: Freshness) {
  return freshness === "stale" || freshness === "unverified";
}
