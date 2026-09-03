import type { SupabaseClient } from "@supabase/supabase-js";
import { logDevOperationError } from "@/lib/dev-log";
import {
  DAY_LABELS,
  REPORT_REASON_LABELS,
  TYPE_LABELS,
  isListingType,
  isReportReason,
  normalizeListingDays,
} from "./types";
import { formatCityWithZip, formatFullLocation } from "./location";
import { listingScheduleLabel } from "./week";

export async function checkIsAdministrator(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logDevOperationError("check administrator access", error);
    return { isAdmin: false };
  }

  if (!data) {
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
  street_address?: string | null;
  zip_code?: string | null;
};

export function listingPreview(row: ListingRowPreview) {
  const type = row.listing_type ?? "";
  const days = normalizeListingDays(row.days);
  const city = row.city?.trim() || "Unknown city";
  const streetAddress = row.street_address?.trim() || null;
  const zipCode = row.zip_code?.trim() || null;
  const location = { streetAddress, city, zipCode };

  return {
    placeName: row.place_name?.trim() || "Untitled listing",
    city,
    cityWithZip: formatCityWithZip(city, zipCode),
    streetAddress,
    zipCode,
    fullLocation: formatFullLocation(location),
    typeLabel: isListingType(type) ? TYPE_LABELS[type] : type || "Event",
    daysLabel: days.map((day) => DAY_LABELS[day]).join(", ") || "No days listed",
    timeLabel: listingScheduleLabel(
      row.start_time,
      row.end_time,
      row.description,
    ),
    description: row.description?.trim() || "No description",
    sourceUrl: row.source_url || null,
  };
}

export function reportReasonLabel(reason: string) {
  if (isReportReason(reason)) return REPORT_REASON_LABELS[reason];
  return "Something else";
}
