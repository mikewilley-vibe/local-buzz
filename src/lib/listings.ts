import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DAYS,
  isCity,
  isListingType,
  type City,
  type DayOfWeek,
  type Listing,
  type ListingDetail,
  type ListingFilters,
  type ListingType,
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
  confirmation_count?: number | null;
  last_verified_at?: string | null;
};

const LISTING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isListingId(value: string) {
  return LISTING_ID_PATTERN.test(value);
}

export type NewListing = {
  placeName: string;
  city: City;
  type: ListingType;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  description: string;
  sourceUrl: string | null;
};

export async function getListings(
  filters: ListingFilters = {},
): Promise<Listing[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("listings")
    .select(
      "id, place_name, city, listing_type, days, start_time, end_time, description, source_url",
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
    console.error("Could not load listings");
    throw new Error("Could not load listings.");
  }

  return (data ?? []).flatMap((row) => {
    const listing = mapListingRow(row as ListingRow);
    return listing ? [listing] : [];
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
        "id, place_name, city, listing_type, days, start_time, end_time, description, source_url, confirmation_count, last_verified_at, status",
      )
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();

    if (error) {
      console.error("Could not load listing");
      throw new Error("Could not load listing.");
    }

    if (!data) {
      return null;
    }

    const listing = mapListingRow(data as ListingRow);
    if (!listing) {
      return null;
    }

    return {
      ...listing,
      confirmationCount: Number(data.confirmation_count ?? 0),
      lastVerifiedAt: data.last_verified_at ?? null,
    };
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
    status: "pending",
  });

  if (error) {
    console.error("Could not submit listing");
    throw new Error("Could not submit listing.");
  }
}

export { isCity, isDay, isListingType } from "./types";

function mapListingRow(row: ListingRow): Listing | null {
  if (!isCity(row.city) || !isListingType(row.listing_type)) {
    return null;
  }

  const days = DAYS.filter((day) => (row.days ?? []).includes(day));
  if (days.length === 0) {
    return null;
  }

  return {
    id: row.id,
    placeName: row.place_name,
    city: row.city,
    type: row.listing_type,
    days,
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    description: row.description,
    sourceUrl: row.source_url,
  };
}
