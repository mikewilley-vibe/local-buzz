export const CITIES = [
  "Norfolk",
  "Virginia Beach",
  "Chesapeake",
  "Portsmouth",
  "Hampton",
  "Newport News",
  "Suffolk",
  "Williamsburg",
] as const;

export type City = (typeof CITIES)[number];

export const LISTING_TYPES = [
  "happy-hour",
  "food-special",
  "trivia",
  "music-bingo",
  "live-music",
  "other",
] as const;

export type ListingType = (typeof LISTING_TYPES)[number];

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayOfWeek = (typeof DAYS)[number];

export type Listing = {
  id: string;
  placeName: string;
  city: City;
  type: ListingType;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  description: string;
  sourceUrl: string | null;
};

export type ListingFilters = {
  city?: City;
  type?: ListingType;
};

export function isCity(value: string): value is City {
  return (CITIES as readonly string[]).includes(value);
}

export function isListingType(value: string): value is ListingType {
  return (LISTING_TYPES as readonly string[]).includes(value);
}

export function isDay(value: string): value is DayOfWeek {
  return (DAYS as readonly string[]).includes(value);
}

export const TYPE_LABELS: Record<ListingType, string> = {
  "happy-hour": "Happy hour",
  "food-special": "Food special",
  trivia: "Trivia",
  "music-bingo": "Music bingo",
  "live-music": "Live music",
  other: "Event",
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
