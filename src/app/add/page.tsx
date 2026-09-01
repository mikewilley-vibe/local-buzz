import { AddListingForm } from "@/components/AddListingForm";

export default function AddPage() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          Contribute
        </p>
        <h1 className="mt-2 font-display text-4xl text-[var(--ink)]">
          Add a listing
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Know a happy hour, taco night, trivia, or band? Submit it here.
          Community listings are reviewed before they appear on the calendar.
        </p>
      </div>
      <AddListingForm />
    </div>
  );
}
