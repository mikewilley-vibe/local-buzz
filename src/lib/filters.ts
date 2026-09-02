import { isZipCode, ZIP_CODE_HINT } from "@/lib/location";
import { isCity, isListingType, type ListingFilters } from "@/lib/types";

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export type ParsedListingFilters = ListingFilters & {
  zipInput: string;
  zipError: string | null;
};

export function parseZipInput(value: string) {
  const zipInput = value.trim();
  if (!zipInput) {
    return { zip: undefined, zipInput: "", zipError: null as string | null };
  }

  if (isZipCode(zipInput)) {
    return { zip: zipInput, zipInput, zipError: null as string | null };
  }

  return { zip: undefined, zipInput, zipError: ZIP_CODE_HINT };
}

export function parseListingFilters(searchParams: {
  city?: string | string[];
  type?: string | string[];
  zip?: string | string[];
  submitted?: string | string[];
}): ParsedListingFilters {
  const cityValue = firstString(searchParams.city);
  const typeValue = firstString(searchParams.type);
  const zipState = parseZipInput(firstString(searchParams.zip));

  return {
    city: isCity(cityValue) ? cityValue : undefined,
    type: isListingType(typeValue) ? typeValue : undefined,
    zip: zipState.zip,
    zipInput: zipState.zipInput,
    zipError: zipState.zipError,
  };
}

export function hasSubmittedConfirmation(searchParams: {
  submitted?: string | string[];
}) {
  return firstString(searchParams.submitted) === "1";
}

export function listingsHref(
  filters: { city?: string; type?: string; zip?: string },
  options: { submitted?: boolean } = {},
) {
  const params = new URLSearchParams();

  if (filters.city && isCity(filters.city)) params.set("city", filters.city);
  if (filters.type && isListingType(filters.type)) params.set("type", filters.type);
  const zip = filters.zip?.trim();
  if (zip && isZipCode(zip)) params.set("zip", zip);
  if (options.submitted) params.set("submitted", "1");

  const query = params.toString();
  return query ? `/?${query}` : "/";
}
