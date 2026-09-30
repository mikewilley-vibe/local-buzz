export const GENERIC_HAPPY_HOUR_REJECTION_REASON =
  "Generic recurring happy hour without a specific event, named night, or concrete deal.";

export type ScoutValueInput = {
  listingType: string;
  days: string[];
  description: string;
  placeName?: string;
  startTime?: string | null;
};

const NAMED_EVENT_TYPES = new Set(["trivia", "music-bingo", "live-music"]);

const NAMED_EVENT_PATTERN =
  /\b(trivia|karaoke|comedy|bingo|open[\s-]?mic|live[\s-]?music|music[\s-]?bingo|pub[\s-]?quiz|taco[\s-]?tuesday|wing[\s-]?wednesday|burger[\s-]?night|date[\s-]?night|industry[\s-]?night|service[\s-]?industry|yappy[\s-]?hour|cornhole|paint[\s-]?night|paint[\s-]?and[\s-]?sip)\b/i;

const CONCRETE_DEAL_PATTERN =
  /\$\s*\d|\d+\s*%|½|\b1\s*\/\s*2\b|\bhalf[\s-]?off\b|\bhalf[\s-]?price\b|\b\d+\s*cents?\b|\b\d+-cent\b|\bbuy[\s-]?one\b|\bbogo\b|\b\d+\s*off\b|\bdollar drinks?\b|\bdouble prices?\b|\bpriced as pints\b/i;

const GENERIC_CADENCE_PATTERN =
  /\b(every[\s-]?day|everyday|daily|all[\s-]?week|7[\s-]?days|monday\s*(through|thru|to|–|-)\s*friday|weekdays?|mon(?:day)?\s*[-–]\s*fri(?:day)?)\b/i;

const GENERIC_PROMOTION_LABEL_PATTERN =
  /\b(happy[\s-]?hour|drink specials?|food and drink specials?|weekly specials?|daily specials?|food specials?)\b/i;

const LIMITED_TIME_PATTERN =
  /\b(limited[\s-]?time|this week only|one[\s-]?night only|tonight|while (they |supplies )?last)\b/i;

const NAMED_DATE_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\bthis (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)\b/i;

export const SCOUT_VALUE_RANK = {
  namedEventWithDateTime: 0,
  recurringNamedEvent: 1,
  specificDeal: 2,
  limitedTime: 3,
  generalVenueEvent: 4,
  genericHappyHour: 99,
} as const;

function blob(input: ScoutValueInput) {
  return `${input.placeName ?? ""} ${input.description}`;
}

export function hasNamedEvent(input: ScoutValueInput) {
  return NAMED_EVENT_TYPES.has(input.listingType) || NAMED_EVENT_PATTERN.test(blob(input));
}

export function hasConcreteDeal(input: ScoutValueInput) {
  return CONCRETE_DEAL_PATTERN.test(blob(input));
}

export function hasConcreteScoutValue(input: ScoutValueInput) {
  return hasNamedEvent(input) || hasConcreteDeal(input);
}

export function isGenericRecurringPromotion(input: ScoutValueInput) {
  if (hasConcreteScoutValue(input)) return false;

  const text = blob(input);
  const looksLikeGenericPromotion =
    input.listingType === "happy-hour" || GENERIC_PROMOTION_LABEL_PATTERN.test(text);
  if (!looksLikeGenericPromotion) return false;

  const broadCadence =
    input.days.length >= 5 || GENERIC_CADENCE_PATTERN.test(text);

  return input.listingType === "happy-hour" || broadCadence;
}

export function scoutValueRank(input: ScoutValueInput) {
  if (isGenericRecurringPromotion(input)) {
    return SCOUT_VALUE_RANK.genericHappyHour;
  }

  const text = blob(input);
  const named = hasNamedEvent(input);
  const hasClock = Boolean(input.startTime);
  if (named && (hasClock || NAMED_DATE_PATTERN.test(text))) {
    return SCOUT_VALUE_RANK.namedEventWithDateTime;
  }
  if (named) return SCOUT_VALUE_RANK.recurringNamedEvent;
  if (hasConcreteDeal(input)) return SCOUT_VALUE_RANK.specificDeal;
  if (LIMITED_TIME_PATTERN.test(text)) return SCOUT_VALUE_RANK.limitedTime;
  return SCOUT_VALUE_RANK.generalVenueEvent;
}

export function compareScoutValue(a: ScoutValueInput, b: ScoutValueInput) {
  return scoutValueRank(a) - scoutValueRank(b);
}

export function scoutOfferKey(input: {
  placeName: string;
  city: string;
  listingType: string;
  days: string[];
}) {
  return [
    input.placeName.trim().toLowerCase(),
    input.city.trim().toLowerCase(),
    input.listingType,
    [...input.days].sort().join(","),
  ].join("|");
}

export function candidateDedupeKey(
  placeName: string,
  city: string,
  listingType: string,
  days: string[],
) {
  return scoutOfferKey({ placeName, city, listingType, days })
    .replace(/[^a-z0-9|,]+/g, "-")
    .slice(0, 200);
}

export const REVIEW_EXCERPT_LENGTH = 180;

export type ScoutReviewCandidate = {
  id: string;
  place_name: string;
  city: string;
  listing_type: string;
  days: string[];
  start_time: string | null;
  description: string;
  confidence: number;
};

export function clipScoutExcerpt(excerpt: string, maxLength = REVIEW_EXCERPT_LENGTH) {
  const normalized = excerpt.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength).replace(/\s+\S*$/, "").trimEnd();
  return `${clipped || normalized.slice(0, maxLength)}…`;
}

export function collapseScoutDuplicates<T extends ScoutReviewCandidate>(candidates: T[]) {
  const best = new Map<string, T>();
  for (const candidate of candidates) {
    const key = scoutOfferKey({
      placeName: candidate.place_name,
      city: candidate.city,
      listingType: candidate.listing_type,
      days: candidate.days,
    });
    const existing = best.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      best.set(key, candidate);
    }
  }
  return [...best.values()];
}

export function groupScoutCandidatesByVenue<T extends ScoutReviewCandidate>(candidates: T[]) {
  const unique = collapseScoutDuplicates(candidates);
  unique.sort((left, right) => {
    const byValue = compareScoutValue(
      {
        listingType: left.listing_type,
        days: left.days,
        description: left.description,
        placeName: left.place_name,
        startTime: left.start_time,
      },
      {
        listingType: right.listing_type,
        days: right.days,
        description: right.description,
        placeName: right.place_name,
        startTime: right.start_time,
      },
    );
    if (byValue !== 0) return byValue;
    const byPlace = left.place_name.localeCompare(right.place_name);
    if (byPlace !== 0) return byPlace;
    return right.confidence - left.confidence;
  });

  const groups: Array<{ placeName: string; city: string; offers: T[] }> = [];
  const index = new Map<string, (typeof groups)[number]>();
  for (const candidate of unique) {
    const key = `${candidate.place_name.trim().toLowerCase()}|${candidate.city}`;
    let group = index.get(key);
    if (!group) {
      group = {
        placeName: candidate.place_name,
        city: candidate.city,
        offers: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.offers.push(candidate);
  }
  return groups;
}
