"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { revalidatePublicListings } from "@/app/actions";
import { ListingFormFields } from "@/components/ListingFormFields";
import { listingFormToUpdate, parseListingFormData } from "@/lib/listing-form";
import { logDevOperationError } from "@/lib/dev-log";
import { ensureAnonymousUser } from "@/lib/supabase/client";

const GENERIC_ERROR = "Could not submit listing.";

export function AddListingForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = parseListingFormData(new FormData(event.currentTarget));
    if ("error" in parsed) {
      setErrorMessage(parsed.error);
      return;
    }

    setPending(true);
    try {
      const { supabase, userId } = await ensureAnonymousUser();
      if (!userId) {
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      const { error } = await supabase.from("listings").insert({
        ...listingFormToUpdate(parsed.listing),
      });

      if (error) {
        logDevOperationError("submit listing", error);
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      await revalidatePublicListings();
      router.push("/?submitted=1");
    } catch (error) {
      logDevOperationError("submit listing", error);
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => void onSubmit(event)}>
      {errorMessage ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
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
