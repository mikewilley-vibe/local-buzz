"use client";

import { useActionState } from "react";
import { addListing, type FormState } from "@/app/actions";
import { CITIES, DAYS, DAY_LABELS, LISTING_TYPES, TYPE_LABELS } from "@/lib/types";

const initialState: FormState = null;

export function AddListingForm() {
  const [state, formAction, pending] = useActionState(addListing, initialState);

  return (
    <form action={formAction} className="grid gap-5">
      {state?.error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">
          Bar or restaurant
        </span>
        <input
          name="placeName"
          required
          placeholder="e.g. The Birch"
          className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">City</span>
          <select
            name="city"
            required
            defaultValue=""
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
          >
            <option value="" disabled>
              Choose a city
            </option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">Type</span>
          <select
            name="type"
            required
            defaultValue=""
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
          >
            <option value="" disabled>
              What is it?
            </option>
            {LISTING_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-[var(--ink)]">
          Days it happens
        </legend>
        <p className="text-sm text-[var(--muted)]">
          Weekly listings: pick every day this special or event usually runs.
        </p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <label
              key={day}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-sm has-[:checked]:border-[var(--amber)] has-[:checked]:bg-[var(--wash)]"
            >
              <input type="checkbox" name="days" value={day} className="accent-[var(--amber-deep)]" />
              {DAY_LABELS[day]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">Starts</span>
          <input
            type="time"
            name="startTime"
            required
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">
            Ends <span className="font-normal text-[var(--muted)]">(optional)</span>
          </span>
          <input
            type="time"
            name="endTime"
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
          />
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">
          What’s the special or event?
        </span>
        <textarea
          name="description"
          required
          rows={4}
          placeholder="e.g. $5 tacos and $3 domestics, or trivia with $10 entry"
          className="resize-y rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">
          Source URL{" "}
          <span className="font-normal text-[var(--muted)]">(optional)</span>
        </span>
        <input
          type="url"
          name="sourceUrl"
          placeholder="https://example.com/happy-hour"
          className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
        />
        <span className="text-sm text-[var(--muted)]">
          Link to the restaurant website, menu, or event post.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[var(--amber)] px-5 py-3 font-medium text-[var(--ink)] hover:bg-[var(--amber-hover)] disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
