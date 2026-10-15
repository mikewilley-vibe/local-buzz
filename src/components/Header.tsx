import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";
import { regionPlaceName, type Region } from "@/lib/region";

const pillClassName =
  "inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm font-medium outline-none ring-[var(--amber)] focus-visible:ring-2";

export function Header({ region }: { region: Region }) {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/?region=${region}`} className="group">
            <p className="font-display text-xl tracking-tight text-[var(--ink)] sm:text-2xl">
              {PRODUCT_NAME}
            </p>
            <p className="text-xs text-[var(--muted)] sm:text-sm">
              {regionPlaceName(region)} this week
            </p>
          </Link>
          <div
            role="group"
            aria-label="Region"
            className="flex items-center gap-1"
          >
            {(["757", "rva"] as const).map((option) => {
              const selected = option === region;
              return (
                <Link
                  key={option}
                  href={`/?region=${option}`}
                  aria-current={selected ? "page" : undefined}
                  className={
                    selected
                      ? `${pillClassName} bg-[var(--amber)] text-[var(--ink)]`
                      : `${pillClassName} border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--wash)]`
                  }
                >
                  {option === "rva" ? "RVA" : "757"}
                </Link>
              );
            })}
          </div>
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
          <Link
            href={`/?region=${region}`}
            className="rounded-full px-3 py-1.5 text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
          >
            This week
          </Link>
          <Link
            href={`/venues?region=${region}`}
            className="rounded-full px-3 py-1.5 text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
          >
            Venues
          </Link>
          <Link
            href="/account"
            className="rounded-full px-3 py-1.5 text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
          >
            My points
          </Link>
          <Link
            href={`/add?region=${region}`}
            className="rounded-full bg-[var(--amber)] px-3 py-1.5 font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2"
          >
            Add a listing
          </Link>
        </nav>
      </div>
    </header>
  );
}
