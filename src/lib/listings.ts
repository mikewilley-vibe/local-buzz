import { promises as fs } from "fs";
import path from "path";
import { CITIES, DAYS, LISTING_TYPES, type Listing } from "./types";

const listingsPath = path.join(process.cwd(), "data", "listings.json");

export async function getListings(): Promise<Listing[]> {
  const raw = await fs.readFile(listingsPath, "utf8");
  return JSON.parse(raw) as Listing[];
}

export async function addListingRecord(listing: Listing) {
  const listings = await getListings();
  listings.push(listing);
  await fs.writeFile(listingsPath, `${JSON.stringify(listings, null, 2)}\n`);
}

export function isCity(value: string): value is Listing["city"] {
  return (CITIES as readonly string[]).includes(value);
}

export function isListingType(value: string): value is Listing["type"] {
  return (LISTING_TYPES as readonly string[]).includes(value);
}

export function isDay(value: string): value is Listing["days"][number] {
  return (DAYS as readonly string[]).includes(value);
}
