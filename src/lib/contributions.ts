import type { SupabaseClient, User } from "@supabase/supabase-js";
import { logDevOperationError } from "@/lib/dev-log";
import {
  DAY_LABELS,
  TYPE_LABELS,
  isListingType,
  normalizeListingDays,
} from "@/lib/types";

export const CONTRIBUTION_STATUSES = ["pending", "approved", "rejected"] as const;

export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export type Contribution = {
  id: string;
  placeName: string;
  title: string;
  city: string;
  typeLabel: string;
  status: ContributionStatus;
  submittedAt: string;
  daysLabel: string | null;
};

export type ContributionList = {
  items: Contribution[];
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

const STATUS_LABELS: Record<ContributionStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function contributionStatusLabel(status: ContributionStatus) {
  return STATUS_LABELS[status];
}

function isContributionStatus(value: string): value is ContributionStatus {
  return (CONTRIBUTION_STATUSES as readonly string[]).includes(value);
}

export function emptyContributionList(): ContributionList {
  return {
    items: [],
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };
}

export async function loadContributorListings(
  supabase: SupabaseClient,
  user: User,
): Promise<ContributionList> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, place_name, description, city, listing_type, status, days, submitted_at, created_at",
    )
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logDevOperationError("load contributor listings", error);
    throw new Error("Couldn’t load your contributions. Please try again.");
  }

  const items: Contribution[] = [];

  for (const row of data ?? []) {
    const status = String(row.status ?? "");
    if (!isContributionStatus(status)) continue;

    const type = row.listing_type ?? "";
    const days = normalizeListingDays(row.days);
    const submittedAt = String(row.submitted_at ?? row.created_at ?? "");

    items.push({
      id: row.id,
      placeName: row.place_name?.trim() || "Untitled listing",
      title: row.description?.trim() || "No description",
      city: row.city?.trim() || "Unknown city",
      typeLabel: isListingType(type) ? TYPE_LABELS[type] : type || "Event",
      status,
      submittedAt,
      daysLabel:
        days.length > 0 ? days.map((day) => DAY_LABELS[day]).join(", ") : null,
    });
  }

  items.sort((left, right) => {
    const leftTime = Date.parse(left.submittedAt);
    const rightTime = Date.parse(right.submittedAt);
    const leftSafe = Number.isNaN(leftTime) ? 0 : leftTime;
    const rightSafe = Number.isNaN(rightTime) ? 0 : rightTime;
    return rightSafe - leftSafe;
  });

  return {
    items,
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    approved: items.filter((item) => item.status === "approved").length,
    rejected: items.filter((item) => item.status === "rejected").length,
  };
}
