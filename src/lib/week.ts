import { DAYS, DAY_LABELS, isDay, type DayOfWeek, type Listing } from "./types";

export const EASTERN_TIME_ZONE = "America/New_York";

export function easternDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayName = get("weekday").toLowerCase();

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: isDay(weekdayName) ? weekdayName : ("monday" as DayOfWeek),
  };
}

export function easternTodayDay(date = new Date()): DayOfWeek {
  return easternDateParts(date).weekday;
}

export function easternCalendarUtc(date = new Date()) {
  const parts = easternDateParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export type WeekDay = {
  key: DayOfWeek;
  label: string;
  headingDate: string;
  dateLabel: string;
  dayNumber: number;
  isToday: boolean;
};

function addDays(year: number, month: number, day: number, offset: number) {
  const utc = Date.UTC(year, month - 1, day + offset);
  const next = new Date(utc);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function formatDateLabel(year: number, month: number, day: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatHeadingDate(year: number, month: number, day: number) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function getThisWeek(): WeekDay[] {
  const today = easternDateParts();
  const todayKey = today.weekday;
  const todayIndex = DAYS.indexOf(todayKey);
  const mondayOffset = -todayIndex;

  return DAYS.map((key, index) => {
    const date = addDays(today.year, today.month, today.day, mondayOffset + index);
    return {
      key,
      label: DAY_LABELS[key],
      headingDate: formatHeadingDate(date.year, date.month, date.day),
      dateLabel: formatDateLabel(date.year, date.month, date.day),
      dayNumber: date.day,
      isToday: key === todayKey,
    };
  });
}

export function compareListingsByStartTime(left: Listing, right: Listing) {
  const leftTime = left.startTime.trim();
  const rightTime = right.startTime.trim();
  if (!leftTime && !rightTime) {
    return left.placeName.localeCompare(right.placeName, "en", {
      sensitivity: "base",
    });
  }
  if (!leftTime) return 1;
  if (!rightTime) return -1;
  const timeOrder = leftTime.localeCompare(rightTime);
  if (timeOrder !== 0) return timeOrder;
  return left.placeName.localeCompare(right.placeName, "en", {
    sensitivity: "base",
  });
}

export function formatTimeRange(startTime: string, endTime: string) {
  const start = formatTime(startTime);
  const end = endTime ? formatTime(endTime) : "";
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  return "";
}

export function formatVerifiedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: EASTERN_TIME_ZONE,
  }).format(date);
}

export function confirmationCountLabel(count: number) {
  if (count === 1) return "1 confirmation";
  return `${count} confirmations`;
}

export function formatDisplayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: EASTERN_TIME_ZONE,
  }).format(date);
}

function formatTime(value: string) {
  if (!value) return "";
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const period = hours >= 12 ? "p.m." : "a.m.";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  if (minutes === 0) return `${hour12} ${period}`;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}
