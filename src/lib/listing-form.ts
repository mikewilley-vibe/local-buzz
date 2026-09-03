import {
  isCity,
  isDay,
  isListingType,
  normalizeListingDays,
  type City,
  type DayOfWeek,
  type ListingType,
} from "./types";
import { STREET_ADDRESS_MAX, ZIP_CODE_PATTERN } from "./location";

export type ListingFormValues = {
  placeName: string;
  city: City;
  type: ListingType;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  description: string;
  sourceUrl: string | null;
  streetAddress: string | null;
  zipCode: string | null;
};

export type ListingFormSeed = {
  placeName: string;
  city: string;
  type: string;
  days: string[];
  startTime: string;
  endTime: string;
  description: string;
  sourceUrl: string;
  streetAddress: string;
  zipCode: string;
};

const TIME_PATTERN = /^\d{2}:\d{2}(?::\d{2})?$/;

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function timeInputValue(value: string | null | undefined) {
  if (!value || value === "null" || value === "undefined") return "";
  return value.slice(0, 5);
}

export function seedFromListingRow(row: {
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
}): ListingFormSeed {
  return {
    placeName: row.place_name ?? "",
    city: row.city ?? "",
    type: row.listing_type ?? "",
    days: normalizeListingDays(row.days),
    startTime: timeInputValue(row.start_time),
    endTime: timeInputValue(row.end_time),
    description: row.description ?? "",
    sourceUrl: row.source_url ?? "",
    streetAddress: row.street_address ?? "",
    zipCode: row.zip_code ?? "",
  };
}

export function listingFormToUpdate(listing: ListingFormValues) {
  return {
    place_name: listing.placeName,
    city: listing.city,
    listing_type: listing.type,
    days: listing.days,
    start_time: listing.startTime || null,
    end_time: listing.endTime || null,
    description: listing.description,
    source_url: listing.sourceUrl,
    street_address: listing.streetAddress,
    zip_code: listing.zipCode,
  };
}

export function parseListingFormData(
  formData: FormData,
): { error: string } | { listing: ListingFormValues } {
  const placeName = String(formData.get("placeName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const streetAddress = String(formData.get("streetAddress") ?? "").trim();
  const zipCode = String(formData.get("zipCode") ?? "").trim();
  const days = formData
    .getAll("days")
    .map((value) => String(value))
    .filter(isDay);

  if (!placeName) return { error: "Please add the bar or restaurant name." };
  if (!isCity(city)) return { error: "Please pick a Hampton Roads city." };
  if (!isListingType(type)) {
    return { error: "Please pick what kind of listing this is." };
  }
  if (days.length === 0) {
    return { error: "Please pick at least one day of the week." };
  }
  if (!startTime || !TIME_PATTERN.test(startTime)) {
    return { error: "Please add a start time." };
  }
  if (endTime && !TIME_PATTERN.test(endTime)) {
    return { error: "Please enter a valid end time, or leave it blank." };
  }
  if (!description) return { error: "Please add a short description." };
  if (sourceUrl && !isHttpUrl(sourceUrl)) {
    return {
      error: "Please enter a valid http or https link, or leave Source URL blank.",
    };
  }
  if (streetAddress.length > STREET_ADDRESS_MAX) {
    return {
      error: "Please keep the street address to 200 characters or fewer.",
    };
  }
  if (zipCode && !ZIP_CODE_PATTERN.test(zipCode)) {
    return {
      error: "Please enter a 5-digit ZIP code, a ZIP+4, or leave it blank.",
    };
  }

  return {
    listing: {
      placeName,
      city,
      type,
      days,
      startTime,
      endTime,
      description,
      sourceUrl: sourceUrl || null,
      streetAddress: streetAddress || null,
      zipCode: zipCode || null,
    },
  };
}
