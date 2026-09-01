import { isCity, isListingType, type ListingFilters } from "@/lib/types";

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseListingFilters(searchParams: {
  city?: string | string[];
  type?: string | string[];
  submitted?: string | string[];
}): ListingFilters {
  const cityValue = firstString(searchParams.city);
  const typeValue = firstString(searchParams.type);

  return {
    city: isCity(cityValue) ? cityValue : undefined,
    type: isListingType(typeValue) ? typeValue : undefined,
  };
}

export function hasSubmittedConfirmation(searchParams: {
  submitted?: string | string[];
}) {
  return firstString(searchParams.submitted) === "1";
}

export function listingsHref(
  filters: { city?: string; type?: string },
  options: { submitted?: boolean } = {},
) {
  const params = new URLSearchParams();

  if (filters.city && isCity(filters.city)) params.set("city", filters.city);
  if (filters.type && isListingType(filters.type)) params.set("type", filters.type);
  if (options.submitted) params.set("submitted", "1");

  const query = params.toString();
  return query ? `/?${query}` : "/";
}
