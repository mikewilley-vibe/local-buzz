import { isZipCode, ZIP_CODE_HINT } from "@/lib/location";
import { isRegion, type Region } from "@/lib/region";
import {
  cityInRegion,
  isCity,
  isDay,
  isListingType,
  parseCityValues,
  type City,
  type DayOfWeek,
  type ListingFilters,
} from "@/lib/types";

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const CALENDAR_VIEWS = ["week", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type CalendarQuery = ListingFilters & {
  day?: DayOfWeek;
  view?: CalendarView;
};

export type ParsedListingFilters = CalendarQuery & {
  cities: City[];
  zipInput: string;
  zipError: string | null;
  region: Region;
};

export function isCalendarView(value: string): value is CalendarView {
  return (CALENDAR_VIEWS as readonly string[]).includes(value);
}

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
  day?: string | string[];
  view?: string | string[];
  submitted?: string | string[];
}): ParsedListingFilters {
  const typeValue = firstString(searchParams.type);
  const dayValue = firstString(searchParams.day).trim().toLowerCase();
  const viewValue = firstString(searchParams.view).trim().toLowerCase();
  const zipState = parseZipInput(firstString(searchParams.zip));
  const cities = parseCityValues(searchParams.city);

  return {
    cities,
    type: isListingType(typeValue) ? typeValue : undefined,
    zip: zipState.zip,
    zipInput: zipState.zipInput,
    zipError: zipState.zipError,
    day: isDay(dayValue) ? dayValue : undefined,
    view: isCalendarView(viewValue) ? viewValue : undefined,
    region: "757",
  };
}

export function hasSubmittedConfirmation(searchParams: {
  submitted?: string | string[];
}) {
  return firstString(searchParams.submitted) === "1";
}

export function cityFilterSummary(cities: City[], region: Region = "757") {
  if (cities.length === 0) {
    return region === "rva" ? "All RVA cities" : "All 757 cities";
  }
  if (cities.length === 1) return cities[0];
  return `${cities[0]} +${cities.length - 1}`;
}

export function formatSelectedArea(cities: City[], region: Region = "757") {
  if (cities.length === 0) {
    return region === "rva" ? "All RVA cities" : "All 757 cities";
  }
  if (cities.length === 1) return cities[0];
  if (cities.length === 2) return `${cities[0]} and ${cities[1]}`;
  const head = cities.slice(0, -1).join(", ");
  return `${head}, and ${cities[cities.length - 1]}`;
}

export function listingsHref(
  filters: {
    cities?: string[] | string;
    city?: string | string[];
    type?: string;
    zip?: string;
    day?: string;
    view?: string;
    region?: Region;
  },
  options: { submitted?: boolean } = {},
) {
  const params = new URLSearchParams();
  const cities = parseCityValues(filters.cities ?? filters.city).filter(
    (city) => !filters.region || cityInRegion(city, filters.region),
  );

  for (const city of cities) {
    if (isCity(city)) params.append("city", city);
  }
  if (filters.type && isListingType(filters.type)) params.set("type", filters.type);
  const zip = filters.zip?.trim();
  if (zip && isZipCode(zip)) params.set("zip", zip);
  if (filters.day && isDay(filters.day)) params.set("day", filters.day);
  if (filters.view && isCalendarView(filters.view)) params.set("view", filters.view);
  if (isRegion(filters.region)) params.set("region", filters.region);
  if (options.submitted) params.set("submitted", "1");

  const query = params.toString();
  return query ? `/?${query}` : "/";
}
