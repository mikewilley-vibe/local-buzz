"use client";

import { useActionState } from "react";
import { addListing, type FormState } from "@/app/actions";
import { ListingFormFields } from "@/components/ListingFormFields";

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

      <ListingFormFields idPrefix="add-listing" disabled={pending} />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
