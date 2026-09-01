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
