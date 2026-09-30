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

export function candidateDedupeKey(
  sourceId: string,
  listingType: string,
  days: string[],
) {
  const schedule = [...days].sort().join(",");
  return `${sourceId}:${listingType}:${schedule}`.toLowerCase().slice(0, 200);
}
