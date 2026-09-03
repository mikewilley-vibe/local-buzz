import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="group">
          <p className="font-display text-xl tracking-tight text-[var(--ink)] sm:text-2xl">
            Local Buzz
          </p>
          <p className="text-xs text-[var(--muted)] sm:text-sm">
            Hampton Roads this week
          </p>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
          <Link
            href="/"
            className="rounded-full px-3 py-1.5 text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2"
          >
            This week
          </Link>
          <Link
            href="/venues"
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
            href="/add"
            className="rounded-full bg-[var(--amber)] px-3 py-1.5 font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2"
          >
            Add a listing
          </Link>
        </nav>
      </div>
    </header>
  );
}
