"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { ListingFormFields } from "@/components/ListingFormFields";
import { logDevOperationError } from "@/lib/dev-log";
import {
  listingFormToUpdate,
  parseListingFormData,
  type ListingFormSeed,
} from "@/lib/listing-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ListingRowPreview } from "@/lib/admin";

const SAVE_ERROR = "Couldn’t save that listing. Please try again.";
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type AdminListingEditTarget = {
  id: string;
  expectedStatus: "pending" | "approved";
  values: ListingFormSeed;
};

export type SavedListingRow = ListingRowPreview & { id: string };

export function AdminListingEditor({
  target,
  onClose,
  onSaved,
}: {
  target: AdminListingEditTarget | null;
  onClose: () => void;
  onSaved: (row: SavedListingRow) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const formId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    savingRef.current = saving;
  }, [onClose, saving]);

  useEffect(() => {
    if (!target) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      document.getElementById(`${formId}-placeName`)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (savingRef.current) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const nodes = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((node) => !node.hasAttribute("disabled") && node.tabIndex !== -1);

      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [formId, target]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || saving) return;

    setErrorMessage(null);
    const parsed = parseListingFormData(new FormData(event.currentTarget));
    if ("error" in parsed) {
      setErrorMessage(parsed.error);
      return;
    }

    setSaving(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("listings")
        .update(listingFormToUpdate(parsed.listing))
        .eq("id", target.id)
        .eq("status", target.expectedStatus)
        .select(
          "id, place_name, city, listing_type, days, start_time, end_time, description, source_url, street_address, zip_code",
        )
        .maybeSingle();

      if (error || !data) {
        logDevOperationError("save admin listing edits", error);
        setErrorMessage(SAVE_ERROR);
        return;
      }

      onSaved(data as SavedListingRow);
    } catch (error) {
      logDevOperationError("save admin listing edits", error);
      setErrorMessage(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  if (!target || typeof document === "undefined") return null;

  const hint =
    target.expectedStatus === "pending"
      ? "Saving keeps this listing pending so you can review it, then approve or reject."
      : "Saving updates the listing. You can still resolve or dismiss the report afterward.";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-stone-900/40"
        aria-hidden="true"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--paper)] shadow-lg sm:rounded-3xl"
      >
        <div className="overflow-y-auto p-5 sm:p-6">
          <h2 id={titleId} className="font-display text-3xl text-[var(--ink)]">
            Edit listing
          </h2>
          <p id={descriptionId} className="mt-2 text-sm text-[var(--muted)]">
            {hint}
          </p>

          <form
            className="mt-5 grid gap-5"
            onSubmit={(event) => void onSubmit(event)}
          >
            {errorMessage ? (
              <p
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            <ListingFormFields
              key={target.id}
              idPrefix={formId}
              defaultValues={target.values}
              disabled={saving}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
