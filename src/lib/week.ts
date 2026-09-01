import { DAYS, type DayOfWeek } from "./types";

const EASTERN = "America/New_York";

function easternDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
  };
}

const WEEKDAY_TO_DAY: Record<string, DayOfWeek> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
};

export type WeekDay = {
  key: DayOfWeek;
  label: string;
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

export function getThisWeek(): WeekDay[] {
  const today = easternDateParts();
  const todayKey = WEEKDAY_TO_DAY[today.weekday] ?? "monday";
  const todayIndex = DAYS.indexOf(todayKey);
  const mondayOffset = -todayIndex;

  const longLabels: Record<DayOfWeek, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };

  return DAYS.map((key, index) => {
    const date = addDays(today.year, today.month, today.day, mondayOffset + index);
    return {
      key,
      label: longLabels[key],
      dateLabel: formatDateLabel(date.year, date.month, date.day),
      dayNumber: date.day,
      isToday: key === todayKey,
    };
  });
}

export function formatTimeRange(startTime: string, endTime: string) {
  const start = formatTime(startTime);
  const end = endTime ? formatTime(endTime) : "";
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  return "";
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
