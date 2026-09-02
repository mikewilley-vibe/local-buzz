import { cache } from "react";
import { logDevOperationError } from "@/lib/dev-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isCity,
  isListingType,
  normalizeListingDays,
  type Listing,
  type ListingDetail,
  type ListingFilters,
} from "./types";
import type { ListingFormValues } from "./listing-form";

type ListingRow = {
  id: string;
  place_name: string;
  city: string;
  listing_type: string;
  days: string[] | null;
  start_time: string;
  end_time: string | null;
  description: string;
  source_url: string | null;
  street_address?: string | null;
  zip_code?: string | null;
  confirmation_count?: number | null;
  last_verified_at?: string | null;
};

const LISTING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isListingId(value: string) {
  return LISTING_ID_PATTERN.test(value);
}

export type NewListing = ListingFormValues;

export async function getListings(
  filters: ListingFilters = {},
): Promise<Listing[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("listings")
    .select(
      "id, place_name, city, listing_type, days, start_time, end_time, description, source_url, street_address, zip_code, confirmation_count, last_verified_at",
    )
    .eq("status", "approved");

  if (filters.city) {
    query = query.eq("city", filters.city);
  }

  if (filters.type) {
    query = query.eq("listing_type", filters.type);
  }

  const { data, error } = await query.order("start_time", { ascending: true });

  if (error) {
    logDevOperationError("load approved listings", error);
    throw new Error("Could not load listings.");
  }

  return (data ?? []).flatMap((row) => {
    try {
      const listing = mapListingRow(row as ListingRow);
      return listing ? [listing] : [];
    } catch (mappingError) {
      logDevOperationError("map approved listing", mappingError);
      return [];
    }
  });
}

export const getApprovedListing = cache(
  async (id: string): Promise<ListingDetail | null> => {
    if (!isListingId(id)) {
      return null;
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, place_name, city, listing_type, days, start_time, end_time, description, source_url, street_address, zip_code, confirmation_count, last_verified_at, status",
      )
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();

    if (error) {
      logDevOperationError("load listing detail", error);
      throw new Error("Could not load listing.");
    }

    if (!data) {
      return null;
    }

    const listing = mapListingRow(data as ListingRow);
    if (!listing) {
      return null;
    }

    return listing;
  },
);

export async function addListingRecord(listing: NewListing) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("listings").insert({
    place_name: listing.placeName,
    city: listing.city,
    listing_type: listing.type,
    days: listing.days,
    start_time: listing.startTime,
    end_time: listing.endTime || null,
    description: listing.description,
    source_url: listing.sourceUrl,
    street_address: listing.streetAddress,
    zip_code: listing.zipCode,
    status: "pending",
  });

  if (error) {
    logDevOperationError("submit listing", error);
    throw new Error("Could not submit listing.");
  }
}

export { isCity, isDay, isListingType } from "./types";

function mapListingRow(row: ListingRow): Listing | null {
  const city = row.city?.trim() ?? "";
  const listingType = row.listing_type?.trim() ?? "";

  if (!isCity(city) || !isListingType(listingType)) {
    logDevOperationError(
      "skip listing with unrecognized city or type",
      { message: row.place_name ?? row.id },
    );
    return null;
  }

  const days = normalizeListingDays(row.days);
  if (days.length === 0) {
    logDevOperationError(
      "skip listing with no matching days",
      { message: row.place_name ?? row.id },
    );
    return null;
  }

  return {
    id: row.id,
    placeName: row.place_name,
    city,
    type: listingType,
    days,
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    description: row.description,
    sourceUrl: row.source_url,
    streetAddress: row.street_address?.trim() || null,
    zipCode: row.zip_code?.trim() || null,
    confirmationCount: Number(row.confirmation_count ?? 0),
    lastVerifiedAt: row.last_verified_at ?? null,
  };
}
