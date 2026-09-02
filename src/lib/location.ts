export const STREET_ADDRESS_MAX = 200;
export const ZIP_CODE_PATTERN = /^\d{5}(-\d{4})?$/;
export const ZIP_CODE_HINT =
  "Enter a 5-digit ZIP code or ZIP+4, like 23510 or 23510-1234.";

export function isZipCode(value: string) {
  return ZIP_CODE_PATTERN.test(value);
}

export function listingMatchesZipFilter(
  listingZip: string | null | undefined,
  filterZip: string,
) {
  const stored = listingZip?.trim() ?? "";
  if (!stored || !isZipCode(stored) || !isZipCode(filterZip)) return false;

  if (filterZip.length === 5) {
    return stored === filterZip || stored.startsWith(`${filterZip}-`);
  }

  return stored === filterZip;
}

export type ListingLocation = {
  streetAddress?: string | null;
  city?: string | null;
  zipCode?: string | null;
};

export function formatCityWithZip(city: string, zipCode?: string | null) {
  const zip = zipCode?.trim();
  if (!zip) return city;
  return `${city} ${zip}`;
}

export function formatFullLocation({
  streetAddress,
  city,
  zipCode,
}: ListingLocation) {
  const street = streetAddress?.trim() || "";
  const cityName = city?.trim() || "";
  const zip = zipCode?.trim() || "";

  const cityState = cityName
    ? `${cityName}, Virginia`
    : street || zip
      ? "Virginia"
      : "";
  const locality = [cityState, zip].filter(Boolean).join(" ");

  return [street, locality].filter(Boolean).join(", ");
}

export function listingDirectionsUrl(location: ListingLocation) {
  const street = location.streetAddress?.trim();
  if (!street) return null;

  const query = formatFullLocation(location);
  if (!query) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
