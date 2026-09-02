"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  createSupabaseBrowserClient,
  ensureAnonymousUser,
} from "@/lib/supabase/client";
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  isReportReason,
  type ReportReason,
} from "@/lib/types";

const NOTE_MAX = 500;
const GENERIC_ERROR = "Couldn’t send that report. Please try again.";
const MISSING_REASON = "Please choose what changed.";

type Status = "checking" | "closed" | "open" | "submitting" | "thanks" | "already";

export function ListingReport({ listingId }: { listingId: string }) {
  const formId = useId();
  const firstReasonRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingReport() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (!cancelled) setStatus("closed");
          return;
        }

        const { data, error } = await supabase
          .from("listing_reports")
          .select("listing_id")
          .eq("listing_id", listingId)
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setStatus("closed");
          return;
        }

        setStatus(data ? "already" : "closed");
      } catch {
        if (!cancelled) setStatus("closed");
      }
    }

    void checkExistingReport();

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  useEffect(() => {
    if (status === "open") {
      firstReasonRef.current?.focus();
    }
  }, [status]);

  function openForm() {
    setErrorMessage(null);
    setStatus("open");
  }

  function closeForm() {
    setErrorMessage(null);
    setStatus("closed");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!isReportReason(reason)) {
      setErrorMessage(MISSING_REASON);
      return;
    }

    const trimmedNote = note.trim().slice(0, NOTE_MAX);
    setStatus("submitting");

    try {
      const { supabase, userId } = await ensureAnonymousUser();

      if (!userId) {
        setStatus("open");
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      const { error } = await supabase.from("listing_reports").insert({
        listing_id: listingId,
        user_id: userId,
        reason,
        note: trimmedNote || null,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          setStatus("already");
          return;
        }

        setStatus("open");
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      setStatus("thanks");
      setReason("");
      setNote("");
    } catch {
      setStatus("open");
      setErrorMessage(GENERIC_ERROR);
    }
  }

  const reported = status === "thanks" || status === "already";
  const formOpen = status === "open" || status === "submitting";
  const noteHelpId = `${formId}-note-help`;
  const noteCountId = `${formId}-note-count`;

  return (
    <section
      className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5"
      aria-labelledby="listing-report-heading"
    >
      <div>
        <h2
          id="listing-report-heading"
          className="font-display text-2xl text-[var(--ink)]"
        >
          Something changed?
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Let us know if this listing needs an update.
        </p>
      </div>

      {status === "thanks" ? (
        <p className="text-sm font-medium text-[var(--ink)]" role="status">
          Thanks — we’ll review this listing.
        </p>
      ) : null}

      {status === "already" ? (
        <p className="text-sm font-medium text-[var(--ink)]" role="status">
          You’ve already reported a change for this listing.
        </p>
      ) : null}

      {!reported && !formOpen ? (
        <button
          type="button"
          onClick={openForm}
          disabled={status === "checking"}
          aria-expanded={false}
          aria-controls={formId}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium text-[var(--ink)] hover:bg-[var(--wash)] disabled:opacity-60 sm:w-auto"
        >
          Something changed?
        </button>
      ) : null}

      {formOpen ? (
        <form id={formId} className="grid gap-4" onSubmit={(event) => void submitReport(event)} noValidate>
          <fieldset className="grid gap-2" disabled={status === "submitting"}>
            <legend className="text-sm font-medium text-[var(--ink)]">
              What’s changed?
            </legend>
            <div className="grid gap-2">
              {REPORT_REASONS.map((value, index) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm has-[:checked]:border-[var(--amber)] has-[:checked]:bg-[var(--wash)]"
                >
                  <input
                    ref={index === 0 ? firstReasonRef : undefined}
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    required
                    className="mt-0.5 accent-[var(--amber-deep)]"
                  />
                  <span>{REPORT_REASON_LABELS[value]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              Note{" "}
              <span className="font-normal text-[var(--muted)]">(optional)</span>
            </span>
            <textarea
              name="note"
              value={note}
              maxLength={NOTE_MAX}
              rows={4}
              disabled={status === "submitting"}
              onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
              aria-describedby={`${noteHelpId} ${noteCountId}`}
              className="resize-y rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2 disabled:opacity-60"
            />
            <span id={noteHelpId} className="text-sm text-[var(--muted)]">
              What needs correction?
            </span>
            <span id={noteCountId} className="text-sm text-[var(--muted)]">
              {note.length}/{NOTE_MAX}
            </span>
          </label>

          {errorMessage ? (
            <p className="text-sm text-red-800" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 text-sm font-medium text-[var(--ink)] hover:bg-[var(--amber-hover)] disabled:opacity-60"
            >
              {status === "submitting" ? "Sending…" : "Send report"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={status === "submitting"}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-[var(--ink)] hover:bg-[var(--wash)] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
