import Link from "next/link";
import {
  contributionStatusLabel,
  type Contribution,
  type ContributionList,
  type ContributionStatus,
} from "@/lib/contributions";
import { formatDisplayDate } from "@/lib/week";

const STATUS_CLASS: Record<ContributionStatus, string> = {
  pending:
    "border-[var(--amber)] bg-[var(--wash)] text-[var(--amber-deep)]",
  approved: "border-emerald-800/25 bg-emerald-50 text-emerald-950",
  rejected: "border-red-300 bg-red-50 text-red-950",
};

function StatusBadge({ status }: { status: ContributionStatus }) {
  return (
    <p
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {contributionStatusLabel(status)}
    </p>
  );
}

function ContributionBody({ item }: { item: Contribution }) {
  const submitted = item.submittedAt
    ? formatDisplayDate(item.submittedAt)
    : null;

  return (
    <article>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
          {item.typeLabel}
        </p>
        <StatusBadge status={item.status} />
      </div>
      <h3 className="mt-1 font-display text-lg leading-snug text-[var(--ink)]">
        {item.placeName}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">{item.title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{item.city}</p>
      {item.daysLabel ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{item.daysLabel}</p>
      ) : null}
      {submitted ? (
        <p className="mt-1 text-sm text-[var(--muted)]">Submitted {submitted}</p>
      ) : null}
    </article>
  );
}

export function ContributorContributions({
  list,
  loading,
  errorMessage,
}: {
  list: ContributionList | null;
  loading: boolean;
  errorMessage: string | null;
}) {
  return (
    <section className="grid gap-3" aria-labelledby="my-contributions-heading">
      <h2
        id="my-contributions-heading"
        className="font-display text-2xl text-[var(--ink)]"
      >
        My contributions
      </h2>

      {loading ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          Loading your contributions…
        </p>
      ) : null}

      {errorMessage ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {!loading && !errorMessage && list ? (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3">
              <dt className="text-sm font-medium text-[var(--ink)]">Submitted</dt>
              <dd className="mt-1 font-display text-2xl text-[var(--ink)]">
                {list.total}
              </dd>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3">
              <dt className="text-sm font-medium text-[var(--ink)]">Pending</dt>
              <dd className="mt-1 font-display text-2xl text-[var(--ink)]">
                {list.pending}
              </dd>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3">
              <dt className="text-sm font-medium text-[var(--ink)]">Approved</dt>
              <dd className="mt-1 font-display text-2xl text-[var(--ink)]">
                {list.approved}
              </dd>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3">
              <dt className="text-sm font-medium text-[var(--ink)]">Rejected</dt>
              <dd className="mt-1 font-display text-2xl text-[var(--ink)]">
                {list.rejected}
              </dd>
            </div>
          </dl>

          {list.items.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              You haven’t submitted a listing yet. Add a listing to see it here
              after it is attributed to your account.
            </p>
          ) : (
            <ul className="grid gap-2">
              {list.items.map((item) => {
                const cardClassName =
                  "block rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4";

                if (item.status === "approved") {
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/listings/${item.id}`}
                        className={`${cardClassName} outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2`}
                      >
                        <ContributionBody item={item} />
                        <p className="mt-2 text-sm font-medium text-[var(--amber-deep)]">
                          View listing
                        </p>
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={item.id} className={cardClassName}>
                    <ContributionBody item={item} />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
