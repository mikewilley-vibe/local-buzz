import {
  CITIES,
  DAYS,
  DAY_LABELS,
  LISTING_TYPES,
  TYPE_LABELS,
  isCity,
  isListingType,
} from "@/lib/types";
import type { ListingFormSeed } from "@/lib/listing-form";

const fieldClass =
  "min-h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2";

export function ListingFormFields({
  defaultValues,
  disabled = false,
  idPrefix,
}: {
  defaultValues?: Partial<ListingFormSeed>;
  disabled?: boolean;
  idPrefix: string;
}) {
  const cityValue = defaultValues?.city ?? "";
  const typeValue = defaultValues?.type ?? "";

  return (
    <>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">
          Bar or restaurant
        </span>
        <input
          id={`${idPrefix}-placeName`}
          name="placeName"
          required
          disabled={disabled}
          defaultValue={defaultValues?.placeName ?? ""}
          placeholder="e.g. The Birch"
          className={fieldClass}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">City</span>
          <select
            id={`${idPrefix}-city`}
            name="city"
            required
            disabled={disabled}
            defaultValue={isCity(cityValue) ? cityValue : ""}
            className={fieldClass}
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
            id={`${idPrefix}-type`}
            name="type"
            required
            disabled={disabled}
            defaultValue={isListingType(typeValue) ? typeValue : ""}
            className={fieldClass}
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

      <fieldset className="grid gap-2" disabled={disabled}>
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
              <input
                type="checkbox"
                name="days"
                value={day}
                defaultChecked={defaultValues?.days?.includes(day)}
                className="accent-[var(--amber-deep)]"
              />
              {DAY_LABELS[day]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">Starts</span>
          <input
            id={`${idPrefix}-startTime`}
            type="time"
            name="startTime"
            required
            disabled={disabled}
            defaultValue={defaultValues?.startTime ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">
            Ends <span className="font-normal text-[var(--muted)]">(optional)</span>
          </span>
          <input
            id={`${idPrefix}-endTime`}
            type="time"
            name="endTime"
            disabled={disabled}
            defaultValue={defaultValues?.endTime ?? ""}
            className={fieldClass}
          />
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">
          What’s the special or event?
        </span>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          required
          disabled={disabled}
          rows={4}
          defaultValue={defaultValues?.description ?? ""}
          placeholder="e.g. $5 tacos and $3 domestics, or trivia with $10 entry"
          className={`resize-y ${fieldClass}`}
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">
          Source URL{" "}
          <span className="font-normal text-[var(--muted)]">(optional)</span>
        </span>
        <input
          id={`${idPrefix}-sourceUrl`}
          type="url"
          name="sourceUrl"
          disabled={disabled}
          defaultValue={defaultValues?.sourceUrl ?? ""}
          placeholder="https://example.com/happy-hour"
          className={fieldClass}
        />
        <span className="text-sm text-[var(--muted)]">
          Link to the restaurant website, menu, or event post.
        </span>
      </label>
    </>
  );
}
