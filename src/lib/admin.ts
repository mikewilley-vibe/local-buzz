import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DAY_LABELS,
  DAYS,
  REPORT_REASON_LABELS,
  TYPE_LABELS,
  isListingType,
  isReportReason,
} from "./types";
import { formatTimeRange } from "./week";

export async function checkIsAdministrator(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { isAdmin: false };
  }

  return { isAdmin: true };
}

export type ListingRowPreview = {
  place_name?: string | null;
  city?: string | null;
  listing_type?: string | null;
  days?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  source_url?: string | null;
};

export function listingPreview(row: ListingRowPreview) {
  const type = row.listing_type ?? "";
  const days = DAYS.filter((day) => (row.days ?? []).includes(day));

  return {
    placeName: row.place_name?.trim() || "Untitled listing",
    city: row.city?.trim() || "Unknown city",
    typeLabel: isListingType(type) ? TYPE_LABELS[type] : type || "Event",
    daysLabel: days.map((day) => DAY_LABELS[day]).join(", ") || "No days listed",
    timeLabel: formatTimeRange(row.start_time ?? "", row.end_time ?? "") || "Time not listed",
    description: row.description?.trim() || "No description",
    sourceUrl: row.source_url || null,
  };
}

export function reportReasonLabel(reason: string) {
  if (isReportReason(reason)) return REPORT_REASON_LABELS[reason];
  return "Something else";
}
