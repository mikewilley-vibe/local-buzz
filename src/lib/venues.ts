import { logDevOperationError } from "@/lib/dev-log";
import { getListings } from "@/lib/listings";
import { formatFullLocation, type ListingLocation } from "@/lib/location";
import { sha256Hex } from "@/lib/sha256";
import { DAYS, DAY_LABELS, type DayOfWeek, type Listing } from "@/lib/types";
import { compareListingsByStartTime } from "@/lib/week";

export const VENUE_STATE = "Virginia";

export type VenueIdentityInput = {
  placeName: string;
  streetAddress?: string | null;
  city: string;
  zipCode?: string | null;
};

export type VenueDirectoryEntry = {
  slug: string;
  name: string;
  city: string;
  listingCount: number;
};

export type VenuePageData = {
  slug: string;
  name: string;
  location: ListingLocation;
  addressLabel: string;
  listings: Listing[];
};

export type VenueDayGroup = {
  key: DayOfWeek;
  label: string;
  listings: Listing[];
};

type VenueGroup = {
  identityKey: string;
  listings: Listing[];
  representative: Listing;
  slug: string;
};

/** SHA-256 prefix. 16 hex chars is 64 bits; FNV-1a 24-bit prefixes can collide. */
export const VENUE_SLUG_HASH_LENGTH = 16;

export function normalizeVenuePart(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function venueIdentityKey(input: VenueIdentityInput) {
  return [
    normalizeVenuePart(input.placeName),
    normalizeVenuePart(input.streetAddress),
    normalizeVenuePart(input.city),
    normalizeVenuePart(VENUE_STATE),
    normalizeVenuePart(input.zipCode),
  ].join("|");
}

export function slugifyVenueText(value: string) {
  const slug = normalizeVenuePart(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "venue";
}

export function venueBaseSlug(input: VenueIdentityInput) {
  return slugifyVenueText(`${input.placeName} ${input.city}`);
}

export function venueIdentityHash(identityKey: string) {
  return sha256Hex(identityKey).slice(0, VENUE_SLUG_HASH_LENGTH);
}

export function venueSlug(input: VenueIdentityInput) {
  const identityKey = venueIdentityKey(input);
  const base = venueBaseSlug(input);
  return `${base}-${venueIdentityHash(identityKey)}`;
}

export function venueSlugFromListing(listing: Listing) {
  return venueSlug({
    placeName: listing.placeName,
    streetAddress: listing.streetAddress,
    city: listing.city ?? "",
    zipCode: listing.zipCode,
  });
}

function venueInputFromListing(listing: Listing): VenueIdentityInput {
  return {
    placeName: listing.placeName,
    streetAddress: listing.streetAddress,
    city: listing.city ?? "",
    zipCode: listing.zipCode,
  };
}

function pickRepresentativeListing(listings: Listing[]) {
  return [...listings].sort((left, right) => {
    const leftStreet = left.streetAddress?.trim().length ?? 0;
    const rightStreet = right.streetAddress?.trim().length ?? 0;
    if (rightStreet !== leftStreet) return rightStreet - leftStreet;
    return left.id.localeCompare(right.id);
  })[0];
}

function groupListingsByIdentity(listings: Listing[]) {
  const groups = new Map<string, Listing[]>();

  for (const listing of listings) {
    const key = venueIdentityKey(venueInputFromListing(listing));
    const current = groups.get(key);
    if (current) current.push(listing);
    else groups.set(key, [listing]);
  }

  return groups;
}

function venueGroupsFromListings(listings: Listing[]): VenueGroup[] {
  return [...groupListingsByIdentity(listings).entries()].map(
    ([identityKey, groupListings]) => {
      const representative = pickRepresentativeListing(groupListings);
      return {
        identityKey,
        listings: groupListings,
        representative,
        slug: venueSlugFromListing(representative),
      };
    },
  );
}

function indexUniqueVenueGroups(listings: Listing[]) {
  const bySlug = new Map<string, VenueGroup[]>();

  for (const group of venueGroupsFromListings(listings)) {
    const existing = bySlug.get(group.slug);
    if (existing) existing.push(group);
    else bySlug.set(group.slug, [group]);
  }

  const unique = new Map<string, VenueGroup>();

  for (const [slug, groups] of bySlug) {
    if (groups.length === 1) {
      unique.set(slug, groups[0]);
      continue;
    }

    logDevOperationError("venue slug collision", {
      message: "distinct venue identities produced the same slug",
    });
  }

  return unique;
}

export function groupVenueListingsByDay(listings: Listing[]): VenueDayGroup[] {
  return DAYS.map((key) => ({
    key,
    label: DAY_LABELS[key],
    listings: listings
      .filter((listing) => listing.days.includes(key))
      .sort(compareListingsByStartTime),
  }));
}

export function buildVenueDirectory(listings: Listing[]): VenueDirectoryEntry[] {
  const unique = indexUniqueVenueGroups(listings);
  const entries: VenueDirectoryEntry[] = [];

  for (const group of unique.values()) {
    entries.push({
      slug: group.slug,
      name: group.representative.placeName,
      city: group.representative.city ?? "",
      listingCount: group.listings.length,
    });
  }

  return entries.sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name, "en", {
      sensitivity: "base",
    });
    if (nameOrder !== 0) return nameOrder;
    return left.city.localeCompare(right.city, "en", { sensitivity: "base" });
  });
}

export function buildVenuePage(
  listings: Listing[],
  slug: string,
): VenuePageData | null {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;

  const unique = indexUniqueVenueGroups(listings);
  const group = unique.get(trimmed);
  if (!group) return null;

  const { representative, listings: venueListings } = group;
  const location: ListingLocation = {
    streetAddress: representative.streetAddress,
    city: representative.city,
    zipCode: representative.zipCode,
  };

  return {
    slug: group.slug,
    name: representative.placeName,
    location,
    addressLabel: formatFullLocation(location),
    listings: venueListings,
  };
}

export async function getApprovedVenueDirectory() {
  const listings = await getListings();
  return buildVenueDirectory(listings);
}

export async function getApprovedVenueBySlug(slug: string) {
  const listings = await getListings();
  return buildVenuePage(listings, slug);
}
