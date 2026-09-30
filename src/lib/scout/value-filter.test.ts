import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateDedupeKey,
  clipScoutExcerpt,
  collapseScoutDuplicates,
  groupScoutCandidatesByVenue,
  isGenericRecurringPromotion,
  SCOUT_VALUE_RANK,
  scoutValueRank,
} from "./value-filter.ts";

test("rejects generic everyday and weekday happy hours", () => {
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "happy-hour",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      description: "Happy Hour daily from 3–6",
    }),
    true,
  );
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "happy-hour",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      description: "Weekday drink specials",
    }),
    true,
  );
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "food-special",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      description: "Daily food and drink specials",
    }),
    true,
  );
});

test("keeps named events and concrete deals", () => {
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "trivia",
      days: ["tuesday"],
      description: "Tuesday Trivia at 7 PM",
      startTime: "19:00",
    }),
    false,
  );
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "music-bingo",
      days: ["wednesday"],
      description: "Music Bingo every Wednesday at 6:30",
      startTime: "18:30",
    }),
    false,
  );
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "food-special",
      days: ["tuesday"],
      description: "Taco Tuesday: $3 tacos and $5 margaritas",
    }),
    false,
  );
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "live-music",
      days: ["friday"],
      description: "Live music Friday with local band",
    }),
    false,
  );
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "happy-hour",
      days: ["monday", "tuesday", "wednesday", "thursday"],
      description: "Happy hour Monday–Thursday with $4 Jameson",
    }),
    false,
  );
  assert.equal(
    isGenericRecurringPromotion({
      listingType: "happy-hour",
      days: ["monday"],
      description: "Service Industry pros can enjoy all-day Happy Hour and ½ off appetizers every Monday until 9:00 pm.",
    }),
    false,
  );
});

test("ranks named timed events above generic happy hour", () => {
  assert.equal(
    scoutValueRank({
      listingType: "trivia",
      days: ["tuesday"],
      description: "Tuesday Trivia at 7 PM",
      startTime: "19:00",
    }),
    SCOUT_VALUE_RANK.namedEventWithDateTime,
  );
  assert.equal(
    scoutValueRank({
      listingType: "happy-hour",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      description: "Happy Hour daily from 3–6",
    }),
    SCOUT_VALUE_RANK.genericHappyHour,
  );
});

test("builds a stable venue-based dedupe key", () => {
  assert.equal(
    candidateDedupeKey("Cova Brewing", "Norfolk", "trivia", ["wednesday", "tuesday"]),
    "cova-brewing|norfolk|trivia|tuesday,wednesday",
  );
});

test("clips source evidence to a short review quote", () => {
  const excerpt = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
  const clipped = clipScoutExcerpt(excerpt);
  assert.ok(clipped.endsWith("…"));
  assert.ok(clipped.length < excerpt.length);
  assert.ok(clipped.length <= 181);
});

test("keeps the strongest copy of the same venue offer", () => {
  const unique = collapseScoutDuplicates([
    {
      id: "a",
      place_name: "Cova Brewing Company",
      city: "Norfolk",
      listing_type: "trivia",
      days: ["tuesday"],
      start_time: "19:00",
      description: "Tuesday trivia",
      confidence: 0.4,
    },
    {
      id: "b",
      place_name: "Cova Brewing Company",
      city: "Norfolk",
      listing_type: "trivia",
      days: ["tuesday"],
      start_time: "19:00",
      description: "Tuesday trivia at 7 PM",
      confidence: 0.9,
    },
  ]);
  assert.equal(unique.length, 1);
  assert.equal(unique[0]?.id, "b");
});

test("groups remaining offers under one venue", () => {
  const groups = groupScoutCandidatesByVenue([
    {
      id: "trivia",
      place_name: "Afterglow Brewing",
      city: "Norfolk",
      listing_type: "trivia",
      days: ["wednesday"],
      start_time: "19:00",
      description: "Wednesday trivia",
      confidence: 0.8,
    },
    {
      id: "bingo",
      place_name: "Afterglow Brewing",
      city: "Norfolk",
      listing_type: "music-bingo",
      days: ["monday"],
      start_time: "18:30",
      description: "Monday music bingo",
      confidence: 0.7,
    },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.offers.length, 2);
});
