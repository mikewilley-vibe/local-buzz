import { cache } from "react";
import { logDevOperationError } from "@/lib/dev-log";
import { listingMatchesZipFilter } from "@/lib/location";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isCity,
  isListingType,
  normalizeListingDays,
  type Listing,
  type ListingDetail,
  type ListingFilters,
} from "./types";

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

  if (filters.type && isListingType(filters.type)) {
    query = query.eq("listing_type", filters.type);
  }

  const { data, error } = await query.order("start_time", { ascending: true });

  if (error) {
    logDevOperationError("load approved listings", error);
    throw new Error("Could not load listings.");
  }

  const seen = new Set<string>();
  const listings = (data ?? []).flatMap((row) => {
    try {
      const listing = mapListingRow(row as ListingRow);
      if (!listing || seen.has(listing.id)) return [];
      seen.add(listing.id);
      return [listing];
    } catch (mappingError) {
      logDevOperationError("map approved listing", mappingError);
      return [];
    }
  });

  const cities = (filters.cities ?? []).filter(isCity);
  const cityFiltered =
    cities.length === 0
      ? listings
      : listings.filter(
          (listing) => listing.city !== null && cities.includes(listing.city),
        );

  if (!filters.zip) {
    return cityFiltered;
  }

  const zip = filters.zip;
  return cityFiltered.filter((listing) =>
    listingMatchesZipFilter(listing.zipCode, zip),
  );
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

export { isCity, isDay, isListingType } from "./types";

function mapListingRow(row: ListingRow): Listing | null {
  const cityRaw = row.city?.trim() ?? "";
  const listingType = row.listing_type?.trim() ?? "";

  if (!isListingType(listingType)) {
    logDevOperationError(
      "skip listing with unrecognized type",
      { message: row.place_name ?? row.id },
    );
    return null;
  }

  if (cityRaw && !isCity(cityRaw)) {
    logDevOperationError(
      "skip listing with unrecognized city",
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
    city: isCity(cityRaw) ? cityRaw : null,
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
