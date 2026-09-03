import { logDevTiming } from "@/lib/dev-log";
import { isHttpUrl } from "@/lib/listing-form";
import { isZipCode, STREET_ADDRESS_MAX } from "@/lib/location";
import {
  canonicalizeCity,
  isListingType,
  LISTING_TYPES,
  normalizeListingDays,
  TYPE_LABELS,
  type City,
  type DayOfWeek,
  type ListingType,
} from "@/lib/types";
import { listingScheduleLabel } from "@/lib/week";
import { venueIdentityKey } from "@/lib/venues";
import { readWorkbookSheet } from "@/lib/xlsx-sheet";

export const IMPORT_CANDIDATES_SHEET = "Import Candidates";
export const PHONE_CONFIRM_LABEL = "Phone-confirm before approval.";
export const STAFF_IMPORT_STATUS = "pending" as const;
export const STAFF_IMPORT_MAX_FILE_BYTES = 1_048_576;
export const STAFF_IMPORT_MAX_ROWS = 200;
export const STAFF_IMPORT_PREVIEW_TIMEOUT_MS = 15_000;
export const STAFF_IMPORT_DUPLICATE_FETCH_LIMIT = 500;
export const STAFF_IMPORT_DUPLICATE_STATUSES = [
  "pending",
  "approved",
  "outdated",
] as const;

const TIME_PATTERN = /^\d{2}:\d{2}(?::\d{2})?$/;

const EXACT_TYPE_MAP: Record<string, ListingType> = {
  "happy hour": "happy-hour",
  "happy-hour": "happy-hour",
  "food special": "food-special",
  "food-special": "food-special",
  trivia: "trivia",
  "live music": "live-music",
  "live-music": "live-music",
  "music bingo": "music-bingo",
  "music-bingo": "music-bingo",
  other: "other",
};

const SUGGESTED_TYPE_MAP: Record<string, ListingType> = {
  "game night": "other",
  "food pop-up": "food-special",
  "food pop up": "food-special",
  "community event": "other",
  "food & drink special": "food-special",
  "food and drink special": "food-special",
  brunch: "food-special",
};

export type ExistingListingForDuplicate = {
  id: string;
  place_name?: string | null;
  city?: string | null;
  days?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  street_address?: string | null;
  zip_code?: string | null;
  status?: string | null;
};

export type StaffListingInsert = {
  place_name: string;
  city: City;
  listing_type: ListingType;
  days: DayOfWeek[];
  start_time: string | null;
  end_time: string | null;
  description: string;
  source_url: string | null;
  source_checked_at: string | null;
  street_address: string | null;
  zip_code: string;
  status: typeof STAFF_IMPORT_STATUS;
  confirmation_count: 0;
  last_verified_at: null;
  submitted_by: null;
  is_staff_sourced: true;
};

export type StaffImportInsert = {
  listing: StaffListingInsert;
  reviewNote: string | null;
};

export type StaffImportPreviewRow = {
  candidateId: string;
  workbookType: string;
  mappedType: ListingType | null;
  typeMappingKind: "exact" | "suggested" | "unmapped";
  typeMappingLabel: string;
  daysLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  placeName: string;
  title: string;
  description: string;
  streetAddress: string;
  cityLabel: string;
  zipCode: string;
  sourceUrl: string;
  sourceCheckedAt: string | null;
  reviewRecommendation: string;
  needsPhoneConfirm: boolean;
  recurrence: string;
  adminNotes: string;
  errors: string[];
  possibleDuplicates: Array<{ id: string; status: string }>;
  insert: StaffImportInsert | null;
};

export type StaffImportPreview = {
  valid: StaffImportPreviewRow[];
  errors: StaffImportPreviewRow[];
  possibleDuplicates: StaffImportPreviewRow[];
  typeMappings: Array<{
    workbookType: string;
    mappedType: ListingType | null;
    kind: StaffImportPreviewRow["typeMappingKind"];
    label: string;
  }>;
  phoneConfirm: StaffImportPreviewRow[];
};

function cellText(value: string | number | undefined) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function headerKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function excelSerialToIso(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = Date.UTC(1899, 11, 30) + Math.round(value * 86400000);
    return new Date(utc).toISOString();
  }
  const text = cellText(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeCopy(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeTime(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return "";
  return text.slice(0, 5);
}

function mapListingType(workbookType: string): {
  mappedType: ListingType | null;
  kind: StaffImportPreviewRow["typeMappingKind"];
} {
  const key = normalizeCopy(workbookType);
  if (!key) return { mappedType: null, kind: "unmapped" };
  if (isListingType(key)) return { mappedType: key, kind: "exact" };
  if (EXACT_TYPE_MAP[key]) return { mappedType: EXACT_TYPE_MAP[key], kind: "exact" };
  if (SUGGESTED_TYPE_MAP[key]) {
    return { mappedType: SUGGESTED_TYPE_MAP[key], kind: "suggested" };
  }
  return { mappedType: null, kind: "unmapped" };
}

function composeDescription(title: string, publicDescription: string) {
  if (title && publicDescription) {
    if (normalizeCopy(publicDescription).startsWith(normalizeCopy(title))) {
      return publicDescription;
    }
    return `${title}. ${publicDescription}`;
  }
  return publicDescription || title;
}

const REDUNDANT_RECURRENCE = new Set(["weekly", "ongoing"]);

function isInternalCondition(phrase: string) {
  return (
    /source publishes/i.test(phrase) ||
    /official post/i.test(phrase) ||
    /official live/i.test(phrase) ||
    /evidence tier/i.test(phrase) ||
    /phone-confirm/i.test(phrase) ||
    /review recommendation/i.test(phrase) ||
    /admin notes/i.test(phrase) ||
    /leave end time/i.test(phrase)
  );
}

function sentenceCase(phrase: string) {
  const trimmed = phrase.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function publicConditionPhrases(recurrence: string) {
  const phrases: string[] = [];
  const seen = new Set<string>();

  function add(raw: string) {
    const phrase = sentenceCase(raw);
    const key = normalizeCopy(phrase);
    if (!phrase || seen.has(key)) return;
    seen.add(key);
    phrases.push(phrase);
  }

  for (const part of recurrence.split(";")) {
    const phrase = part.replace(/\s+/g, " ").trim();
    if (!phrase) continue;
    if (REDUNDANT_RECURRENCE.has(normalizeCopy(phrase))) continue;
    if (isInternalCondition(phrase)) continue;
    add(phrase);
  }

  if (/\ball[-\s]?day\b/i.test(recurrence)) add("All day");

  return phrases;
}

export function appendPublicConditions(description: string, recurrence: string) {
  let next = description.replace(/\s+/g, " ").trim();
  for (const phrase of publicConditionPhrases(recurrence)) {
    if (normalizeCopy(next).includes(normalizeCopy(phrase))) continue;
    next = `${next.replace(/\.+$/, "")}. ${phrase}.`;
  }
  return next;
}

export function validateStaffWorkbookFile(file: File) {
  const name = file.name.trim().toLowerCase();
  if (!name.endsWith(".xlsx")) {
    return "Please choose an .xlsx workbook.";
  }
  if (file.size <= 0) {
    return "That workbook is empty.";
  }
  if (file.size > STAFF_IMPORT_MAX_FILE_BYTES) {
    return "That workbook is too large. Use a file of 1 MB or smaller.";
  }
  return null;
}

function daysKey(days: DayOfWeek[]) {
  return days.join(",");
}

function isPossibleDuplicate(
  candidate: {
    placeName: string;
    streetAddress: string | null;
    city: City;
    zipCode: string;
    title: string;
    description: string;
    days: DayOfWeek[];
    startTime: string;
    endTime: string;
  },
  existing: ExistingListingForDuplicate,
) {
  const existingCity = canonicalizeCity(existing.city ?? "");
  if (!existingCity) return false;

  const sameVenue =
    venueIdentityKey({
      placeName: candidate.placeName,
      streetAddress: candidate.streetAddress,
      city: candidate.city,
      zipCode: candidate.zipCode,
    }) ===
    venueIdentityKey({
      placeName: existing.place_name ?? "",
      streetAddress: existing.street_address,
      city: existingCity,
      zipCode: existing.zip_code,
    });

  if (!sameVenue) return false;

  const existingDays = daysKey(normalizeListingDays(existing.days));
  if (existingDays !== daysKey(candidate.days)) return false;

  if (
    normalizeTime(existing.start_time) !== candidate.startTime ||
    normalizeTime(existing.end_time) !== candidate.endTime
  ) {
    return false;
  }

  const existingDescription = normalizeCopy(existing.description ?? "");
  const title = normalizeCopy(candidate.title);
  const description = normalizeCopy(candidate.description);
  return (
    existingDescription === description ||
    (title.length > 0 && existingDescription === title) ||
    (title.length > 0 && existingDescription.includes(title))
  );
}

export function buildStaffImportPreview(
  rows: Record<number, Record<number, string | number>>,
  existing: ExistingListingForDuplicate[],
): StaffImportPreview {
  const headerRow =
    Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b)
      .find((row) => cellText(rows[row]?.[0]).toLowerCase().includes("candidate id")) ?? 5;
  const headers = rows[headerRow] ?? {};
  const col = (name: string) => {
    const wanted = headerKey(name);
    return Number(
      Object.keys(headers).find((index) => headerKey(cellText(headers[Number(index)])) === wanted),
    );
  };

  const cols = {
    candidateId: col("Candidate ID"),
    placeName: col("Place Name"),
    title: col("Listing Title"),
    description: col("Public Description"),
    street: col("Street Address"),
    city: col("City"),
    zip: col("ZIP Code"),
    type: col("Suggested Type"),
    days: col("Days"),
    start: col("Start Time"),
    end: col("End Time"),
    recurrence: col("Recurrence / Conditions"),
    sourceUrl: col("Source URL"),
    sourceChecked: col("Source Checked"),
    review: col("Review Recommendation"),
    notes: col("Admin Notes"),
  };

  const previews: StaffImportPreviewRow[] = [];
  const dataRows = Object.keys(rows)
    .map(Number)
    .filter((row) => row > headerRow)
    .sort((a, b) => a - b);
  let candidateCount = 0;

  for (const row of dataRows) {
    const cells = rows[row] ?? {};
    const candidateId = cellText(cells[cols.candidateId]);
    if (!candidateId) continue;
    candidateCount += 1;
    if (candidateCount > STAFF_IMPORT_MAX_ROWS) {
      throw new Error(
        `The Import Candidates sheet has more than ${STAFF_IMPORT_MAX_ROWS} listings.`,
      );
    }

    const placeName = cellText(cells[cols.placeName]);
    const title = cellText(cells[cols.title]);
    const publicDescription = cellText(cells[cols.description]);
    const recurrence = cellText(cells[cols.recurrence]);
    const description = appendPublicConditions(
      composeDescription(title, publicDescription),
      recurrence,
    );
    const streetAddress = cellText(cells[cols.street]);
    const city = canonicalizeCity(cellText(cells[cols.city]));
    const zipCode = cellText(cells[cols.zip]);
    const workbookType = cellText(cells[cols.type]);
    const mapped = mapListingType(workbookType);
    const days = normalizeListingDays(cellText(cells[cols.days]));
    const startRaw = cellText(cells[cols.start]);
    const endRaw = cellText(cells[cols.end]);
    const sourceUrl = cellText(cells[cols.sourceUrl]);
    const sourceCheckedAt = excelSerialToIso(cells[cols.sourceChecked]);
    const reviewRecommendation = cellText(cells[cols.review]);
    const needsPhoneConfirm =
      normalizeCopy(reviewRecommendation) === normalizeCopy(PHONE_CONFIRM_LABEL.replace(/\.$/, "")) ||
      normalizeCopy(reviewRecommendation).includes("phone-confirm before approval");
    const adminNotes = cellText(cells[cols.notes]);

    const errors: string[] = [];
    if (!placeName) errors.push("Venue (place name) is required.");
    if (!description) errors.push("Description is required.");
    if (!city) errors.push("City must be a supported Hampton Roads city.");
    if (!isZipCode(zipCode)) errors.push("ZIP code must be 5 digits or ZIP+4.");
    if (days.length === 0) errors.push("At least one valid day of the week is required.");
    if (!mapped.mappedType) {
      errors.push(
        `Listing type “${workbookType || "blank"}” is not one of: ${LISTING_TYPES.join(", ")}.`,
      );
    }
    if (streetAddress.length > STREET_ADDRESS_MAX) {
      errors.push("Street address must be 200 characters or fewer.");
    }
    if (startRaw && !TIME_PATTERN.test(startRaw)) {
      errors.push("Start time must be HH:MM 24-hour text, or blank.");
    }
    if (endRaw && !TIME_PATTERN.test(endRaw)) {
      errors.push("End time must be HH:MM 24-hour text, or blank.");
    }
    if (sourceUrl && !isHttpUrl(sourceUrl)) {
      errors.push("Source URL must be an http or https link.");
    }
    if (!sourceUrl) errors.push("Source URL is required for staff-sourced rows.");
    if (!sourceCheckedAt) errors.push("Source checked date is required.");

    const startTime = TIME_PATTERN.test(startRaw) ? startRaw.slice(0, 5) : "";
    const endTime = TIME_PATTERN.test(endRaw) ? endRaw.slice(0, 5) : "";
    const possibleDuplicates =
      city && mapped.mappedType && days.length > 0
        ? existing
            .filter((row) =>
              isPossibleDuplicate(
                {
                  placeName,
                  streetAddress: streetAddress || null,
                  city,
                  zipCode,
                  title,
                  description,
                  days,
                  startTime,
                  endTime,
                },
                row,
              ),
            )
            .map((row) => ({
              id: row.id,
              status: row.status ?? "unknown",
            }))
        : [];

    const staffReviewNote = [
      needsPhoneConfirm ? PHONE_CONFIRM_LABEL : "",
      adminNotes,
    ]
      .filter(Boolean)
      .join(" ");

    const insert: StaffImportInsert | null =
      errors.length === 0 && city && mapped.mappedType
        ? {
            listing: {
              place_name: placeName,
              city,
              listing_type: mapped.mappedType,
              days,
              start_time: startTime || null,
              end_time: endTime || null,
              description,
              source_url: sourceUrl,
              source_checked_at: sourceCheckedAt,
              street_address: streetAddress || null,
              zip_code: zipCode,
              status: STAFF_IMPORT_STATUS,
              confirmation_count: 0,
              last_verified_at: null,
              submitted_by: null,
              is_staff_sourced: true,
            },
            reviewNote: staffReviewNote || null,
          }
        : null;

    const typeMappingLabel = mapped.mappedType
      ? mapped.kind === "exact"
        ? `${workbookType} → ${TYPE_LABELS[mapped.mappedType]} (${mapped.mappedType})`
        : `${workbookType} → suggested ${TYPE_LABELS[mapped.mappedType]} (${mapped.mappedType})`
      : `${workbookType || "blank"} → no supported listing type`;

    const scheduleLabel = listingScheduleLabel(
      startTime || null,
      endTime || null,
      description,
    );

    previews.push({
      candidateId,
      workbookType,
      mappedType: mapped.mappedType,
      typeMappingKind: mapped.kind,
      typeMappingLabel,
      daysLabel: days.join(", ") || cellText(cells[cols.days]) || "none",
      startTimeLabel: scheduleLabel,
      endTimeLabel: endTime || "",
      placeName,
      title,
      description,
      streetAddress,
      cityLabel: city ?? cellText(cells[cols.city]),
      zipCode,
      sourceUrl,
      sourceCheckedAt,
      reviewRecommendation,
      needsPhoneConfirm,
      recurrence,
      adminNotes,
      errors,
      possibleDuplicates,
      insert,
    });
  }

  const typeMappings = [
    ...new Map(
      previews.map((row) => [
        row.workbookType,
        {
          workbookType: row.workbookType,
          mappedType: row.mappedType,
          kind: row.typeMappingKind,
          label: row.typeMappingLabel,
        },
      ]),
    ).values(),
  ];

  return {
    valid: previews.filter((row) => row.insert && row.possibleDuplicates.length === 0),
    errors: previews.filter((row) => row.errors.length > 0),
    possibleDuplicates: previews.filter((row) => row.possibleDuplicates.length > 0),
    typeMappings,
    phoneConfirm: previews.filter((row) => row.needsPhoneConfirm),
  };
}

export async function previewStaffWorkbook(
  file: ArrayBuffer,
  existing: ExistingListingForDuplicate[],
) {
  const started = performance.now();
  const rows = await readWorkbookSheet(file, IMPORT_CANDIDATES_SHEET);
  const mapStarted = performance.now();
  const preview = buildStaffImportPreview(rows, existing);
  const candidates = uniqueStaffPreviewRows(preview);
  logDevTiming("staff-import map", {
    mapMs: Math.round(performance.now() - mapStarted),
    existingCount: existing.length,
    candidateCount: candidates.length,
    totalMs: Math.round(performance.now() - started),
  });
  return preview;
}

export function uniqueStaffPreviewRows(preview: StaffImportPreview) {
  const seen = new Set<string>();
  const rows: StaffImportPreviewRow[] = [];
  for (const row of [
    ...preview.valid,
    ...preview.errors,
    ...preview.possibleDuplicates,
    ...preview.phoneConfirm,
  ]) {
    if (seen.has(row.candidateId)) continue;
    seen.add(row.candidateId);
    rows.push(row);
  }
  return rows;
}

export function staffImportDuplicateFilters(preview: StaffImportPreview) {
  const rows = uniqueStaffPreviewRows(preview);
  const cities = new Set<City>();
  const zips = new Set<string>();
  for (const row of rows) {
    const city = canonicalizeCity(row.cityLabel);
    if (city) cities.add(city);
    if (isZipCode(row.zipCode)) zips.add(row.zipCode);
  }
  return {
    cities: [...cities],
    zips: [...zips],
    candidateCount: rows.length,
  };
}
