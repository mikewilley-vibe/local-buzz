"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { confirmationCountLabel, formatVerifiedDate } from "@/lib/week";

const GENERIC_ERROR = "Couldn’t save that confirmation. Please try again.";

type Status = "checking" | "ready" | "saving" | "thanks" | "already";

export function ListingAccuracy({
  listingId,
  confirmationCount,
  lastVerifiedAt,
}: {
  listingId: string;
  confirmationCount: number;
  lastVerifiedAt: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [count, setCount] = useState(confirmationCount);
  const [verifiedAt, setVerifiedAt] = useState(lastVerifiedAt);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingConfirmation() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (!cancelled) setStatus("ready");
          return;
        }

        const { data, error } = await supabase
          .from("listing_confirmations")
          .select("listing_id")
          .eq("listing_id", listingId)
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setStatus("ready");
          return;
        }

        setStatus(data ? "already" : "ready");
      } catch {
        if (!cancelled) setStatus("ready");
      }
    }

    void checkExistingConfirmation();

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  async function refreshListingStats() {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("listings")
      .select("confirmation_count, last_verified_at")
      .eq("id", listingId)
      .eq("status", "approved")
      .maybeSingle();

    if (error || !data) return;

    setCount(Number(data.confirmation_count ?? 0));
    setVerifiedAt(data.last_verified_at ?? null);
  }

  async function confirmListing() {
    setErrorMessage(null);
    setStatus("saving");

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();

      let userId = existingSession?.user.id ?? null;

      if (!userId) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) {
          setStatus("ready");
          setErrorMessage(GENERIC_ERROR);
          return;
        }
        userId = data.user.id;
      }

      const { error } = await supabase.from("listing_confirmations").insert({
        listing_id: listingId,
        user_id: userId,
      });

      if (error) {
        if (error.code === "23505") {
          await refreshListingStats();
          router.refresh();
          setStatus("already");
          return;
        }

        setStatus("ready");
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      await refreshListingStats();
      router.refresh();
      setStatus("thanks");
    } catch {
      setStatus("ready");
      setErrorMessage(GENERIC_ERROR);
    }
  }

  const verifiedLabel = verifiedAt ? formatVerifiedDate(verifiedAt) : null;
  const busy = status === "checking" || status === "saving";
  const confirmed = status === "thanks" || status === "already";

  return (
    <section
      className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5"
      aria-labelledby="listing-accuracy-heading"
    >
      <div>
        <h2
          id="listing-accuracy-heading"
          className="font-display text-2xl text-[var(--ink)]"
        >
          Is this still accurate?
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Help neighbors know this listing is current.
        </p>
      </div>

      {verifiedLabel ? (
        <p className="text-sm text-[var(--muted)]">
          Last verified {verifiedLabel}
        </p>
      ) : null}

      <p className="text-sm text-[var(--muted)]">{confirmationCountLabel(count)}</p>

      {status === "thanks" ? (
        <p className="text-sm font-medium text-[var(--ink)]" role="status">
          Thanks for confirming!
        </p>
      ) : null}

      {status === "already" ? (
        <p className="text-sm font-medium text-[var(--ink)]" role="status">
          You confirmed this listing.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!confirmed ? (
        <button
          type="button"
          onClick={() => void confirmListing()}
          disabled={busy}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 text-sm font-medium text-[var(--ink)] hover:bg-[var(--amber-hover)] disabled:opacity-60 sm:w-auto"
        >
          {status === "saving" ? "Saving…" : "Yes, this is still accurate."}
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 text-sm font-medium text-[var(--ink)] disabled:opacity-60 sm:w-auto"
        >
          Yes, this is still accurate.
        </button>
      )}
    </section>
  );
}
