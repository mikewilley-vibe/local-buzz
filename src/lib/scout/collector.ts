import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  candidateDedupeKey,
  compareScoutValue,
  isGenericRecurringPromotion,
  MAX_LISTINGS_PER_ESTABLISHMENT,
} from "@/lib/scout/value-filter";

export type ScoutSource = {
  id: string;
  placeName: string;
  city: string;
  url: string;
  sourceKind: "website" | "menu" | "social" | "event_calendar" | "other";
};

type ExtractedCandidate = {
  dedupeKey: string;
  placeName: string;
  city: string;
  listingType: string;
  days: string[];
  startTime: string | null;
  endTime: string | null;
  description: string;
  sourceUrl: string;
  streetAddress: string | null;
  zipCode: string | null;
  confidence: number;
};

type ScoutEvidenceInsert = Database["public"]["Tables"]["listing_candidate_evidence"]["Insert"];
type ScoutCandidateInsert = Database["public"]["Tables"]["listing_candidates"]["Insert"];

const MAX_SOURCE_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_MODEL_EXCERPT_LENGTH = 4_000;
const MAX_EVIDENCE_EXCERPT_LENGTH = 180;
const ALLOWED_CITIES = new Set([
  "Norfolk",
  "Virginia Beach",
  "Chesapeake",
  "Portsmouth",
  "Hampton",
  "Newport News",
  "Suffolk",
  "Williamsburg",
]);
const ALLOWED_TYPES = new Set([
  "happy-hour",
  "food-special",
  "trivia",
  "music-bingo",
  "live-music",
  "other",
]);
const ALLOWED_DAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

function text(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function nullableText(value: unknown, maxLength: number) {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function normalizeTime(value: unknown) {
  const normalized = text(value, 8);
  return /^\d{2}:\d{2}(:\d{2})?$/.test(normalized)
    ? normalized.slice(0, 5)
    : null;
}

function normalizeDays(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((day) => text(day, 12).toLowerCase()))].filter(
    (day) => ALLOWED_DAYS.has(day),
  );
}

function htmlToText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function sameSchedule(left: string[], right: string[]) {
  return [...left].sort().join(",") === [...right].sort().join(",");
}

function sourceExcerpt(html: string, hint = "", maxLength = MAX_MODEL_EXCERPT_LENGTH) {
  const body = htmlToText(html);
  const needle = hint.replace(/\s+/g, " ").trim().slice(0, 48);
  let match = needle ? body.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (match < 0) {
    match = body.search(
      /trivia|karaoke|comedy|bingo|live music|taco tuesday|happy hour|specials?|weekly events?/i,
    );
  }
  const padding = maxLength > 400 ? 600 : 24;
  const start = match < 0 ? 0 : Math.max(0, match - padding);
  return body.slice(start, start + maxLength);
}

function parseJsonObject(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return "";
}

function validateCandidate(value: unknown, source: ScoutSource): ExtractedCandidate | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const placeName = text(candidate.placeName, 200) || source.placeName;
  const city = text(candidate.city, 80) || source.city;
  const listingType = text(candidate.listingType, 40);
  const days = normalizeDays(candidate.days);
  const description = text(candidate.description, 2_000);
  const sourceUrl = text(candidate.sourceUrl, 2_000) || source.url;
  const confidence = Number(candidate.confidence);

  if (!placeName || !ALLOWED_CITIES.has(city) || !ALLOWED_TYPES.has(listingType)) return null;
  if (days.length === 0 || !description || !/^https?:\/\//i.test(sourceUrl)) return null;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;

  const extracted: ExtractedCandidate = {
    dedupeKey: candidateDedupeKey(placeName, city, listingType, days),
    placeName,
    city,
    listingType,
    days,
    startTime: normalizeTime(candidate.startTime),
    endTime: normalizeTime(candidate.endTime),
    description,
    sourceUrl,
    streetAddress: nullableText(candidate.streetAddress, 200),
    zipCode: /^\d{5}(-\d{4})?$/.test(text(candidate.zipCode, 10))
      ? text(candidate.zipCode, 10)
      : null,
    confidence,
  };

  if (isGenericRecurringPromotion(extracted)) return null;

  return extracted;
}

async function fetchSource(source: ScoutSource) {
  const response = await fetch(source.url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "LocalBuzz757-Scout/1.0 (+https://local-buzz-swart.vercel.app)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES) {
    throw new Error("Source is larger than the collector limit");
  }

  const html = await response.text();
  if (new TextEncoder().encode(html).byteLength > MAX_SOURCE_BYTES) {
    throw new Error("Source is larger than the collector limit");
  }
  return html;
}

async function extractWithOpenAi(source: ScoutSource, html: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.SCOUT_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Extract only current, explicitly stated special events or concrete deals. Keep trivia, music bingo, karaoke, comedy, live music, themed nights, named food nights, limited-time offers, and specials with a specific price or percent off. Do not extract generic daily, weekday, or every-day happy hours or vague drink specials with no event, price, or named night. Happy hour may be supporting detail, not the listing itself. Do not invent missing dates, times, prices, or details. Return an empty candidates array when the page does not contain a clear event or deal.",
        },
        {
          role: "user",
          content: `Source venue: ${source.placeName}\nSource city: ${source.city}\nSource URL: ${source.url}\n\nPage text:\n${sourceExcerpt(html)}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "hapshere_scout_candidates",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              candidates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    dedupeKey: { type: "string" },
                    placeName: { type: "string" },
                    city: { type: "string" },
                    listingType: { type: "string", enum: [...ALLOWED_TYPES] },
                    days: { type: "array", items: { type: "string", enum: [...ALLOWED_DAYS] } },
                    startTime: { type: ["string", "null"] },
                    endTime: { type: ["string", "null"] },
                    description: { type: "string" },
                    sourceUrl: { type: "string" },
                    streetAddress: { type: ["string", "null"] },
                    zipCode: { type: ["string", "null"] },
                    confidence: { type: "number" },
                  },
                  required: [
                    "dedupeKey", "placeName", "city", "listingType", "days",
                    "startTime", "endTime", "description", "sourceUrl",
                    "streetAddress", "zipCode", "confidence",
                  ],
                },
              },
            },
            required: ["candidates"],
          },
        },
      },
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`OpenAI returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  const parsed = parseJsonObject(responseText(payload));
  const candidates = parsed && Array.isArray((parsed as { candidates?: unknown }).candidates)
    ? (parsed as { candidates: unknown[] }).candidates
    : [];
  return candidates
    .map((candidate) => validateCandidate(candidate, source))
    .filter((candidate): candidate is ExtractedCandidate => candidate !== null);
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Scout service credentials are not configured");
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function readSourceCatalog() {
  const raw = process.env.SCOUT_SOURCE_CATALOG_JSON;
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("SCOUT_SOURCE_CATALOG_JSON must be an array");
  return parsed.filter((source): source is ScoutSource => {
    if (!source || typeof source !== "object") return false;
    const value = source as Record<string, unknown>;
    return typeof value.id === "string" && typeof value.placeName === "string" &&
      typeof value.city === "string" && typeof value.url === "string" &&
      /^https?:\/\//i.test(value.url) && typeof value.sourceKind === "string";
  });
}

export async function collectScoutSources(sourceIds?: string[]) {
  if (process.env.SCOUT_COLLECTOR_ENABLED !== "true") {
    throw new Error("Scout collector is disabled");
  }

  const sources = readSourceCatalog().filter((source) =>
    !sourceIds?.length || sourceIds.includes(source.id),
  );
  const supabase = createServiceClient();
  const results: Array<{ sourceId: string; candidates: number; error?: string }> = [];

  for (const source of sources) {
    try {
      const html = await fetchSource(source);
      const candidates = [...(await extractWithOpenAi(source, html))].sort((left, right) => {
        const byValue = compareScoutValue(left, right);
        if (byValue !== 0) return byValue;
        return right.confidence - left.confidence;
      });

      const { count: pendingCount, error: pendingCountError } = await supabase
        .from("listing_candidates")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review")
        .eq("city", source.city)
        .ilike("place_name", source.placeName);
      if (pendingCountError) throw pendingCountError;
      const { count: approvedCount, error: approvedCountError } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .eq("city", source.city)
        .ilike("place_name", source.placeName);
      if (approvedCountError) throw approvedCountError;
      let remainingSlots = Math.max(
        0,
        MAX_LISTINGS_PER_ESTABLISHMENT - (pendingCount ?? 0) - (approvedCount ?? 0),
      );

      let savedCount = 0;
      for (const candidate of candidates) {
        const { data: publishedMatch, error: publishedError } = await supabase
          .from("listings")
          .select("id")
          .eq("status", "approved")
          .eq("place_name", candidate.placeName)
          .eq("city", candidate.city)
          .eq("listing_type", candidate.listingType)
          .limit(1);
        if (publishedError) throw publishedError;
        if (publishedMatch && publishedMatch.length > 0) continue;

        const { data: siblings, error: siblingError } = await supabase
          .from("listing_candidates")
          .select("id, status, days")
          .eq("city", candidate.city)
          .eq("listing_type", candidate.listingType)
          .ilike("place_name", candidate.placeName);
        if (siblingError) throw siblingError;
        const matching = (siblings ?? []).filter((row) =>
          sameSchedule(row.days, candidate.days),
        );
        if (matching.some((row) => row.status !== "pending_review")) continue;

        const { data: keyed, error: keyedError } = await supabase
          .from("listing_candidates")
          .select("id, status")
          .eq("dedupe_key", candidate.dedupeKey)
          .maybeSingle();
        if (keyedError) throw keyedError;
        if (keyed && keyed.status !== "pending_review") continue;

        const existing =
          matching.find((row) => row.status === "pending_review") ??
          (keyed?.status === "pending_review" ? keyed : null);
        if (!existing && remainingSlots <= 0) continue;

        const candidateFields: ScoutCandidateInsert = {
          dedupe_key: candidate.dedupeKey,
          place_name: candidate.placeName,
          city: candidate.city,
          listing_type: candidate.listingType,
          days: candidate.days,
          start_time: candidate.startTime,
          end_time: candidate.endTime,
          description: candidate.description,
          source_url: candidate.sourceUrl,
          street_address: candidate.streetAddress,
          zip_code: candidate.zipCode,
          confidence: candidate.confidence,
          status: "pending_review",
          discovered_at: new Date().toISOString(),
          last_checked_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        const candidateQuery = existing
          ? supabase
              .from("listing_candidates")
              .update(candidateFields)
              .eq("id", existing.id)
          : supabase.from("listing_candidates").insert(candidateFields);
        const { data: saved, error: candidateError } = await candidateQuery
          .select("id")
          .single();
        if (candidateError) throw candidateError;

        const evidence: ScoutEvidenceInsert = {
          candidate_id: saved.id,
          source_url: source.url,
          source_kind: source.sourceKind,
          source_title: source.placeName,
          excerpt: sourceExcerpt(
            html,
            candidate.description,
            MAX_EVIDENCE_EXCERPT_LENGTH,
          ),
          captured_at: new Date().toISOString(),
        };
        const { error: evidenceError } = await supabase
          .from("listing_candidate_evidence")
          .upsert(evidence, { onConflict: "candidate_id,source_url" });
        if (evidenceError) throw evidenceError;
        if (!existing) remainingSlots -= 1;
        savedCount += 1;
      }
      results.push({ sourceId: source.id, candidates: savedCount });
    } catch (error) {
      results.push({
        sourceId: source.id,
        candidates: 0,
        error: error instanceof Error ? error.message : "Unknown collector error",
      });
    }
  }

  return { sources: sources.length, results };
}

