import { AddListingForm } from "@/components/AddListingForm";
import { regionPlaceName } from "@/lib/region";
import { getRequestRegion } from "@/lib/request-region";

export default async function AddPage() {
  const region = await getRequestRegion();
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
          Know a happy hour, taco night, trivia, or band in{" "}
          {regionPlaceName(region)}? Submit it here. Community listings are
          reviewed before they appear on the calendar.
        </p>
      </div>
      <AddListingForm region={region} />
    </div>
  );
}
