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
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="rounded-full px-3 py-1.5 text-[var(--ink)] hover:bg-[var(--wash)]"
          >
            This week
          </Link>
          <Link
            href="/add"
            className="rounded-full bg-[var(--amber)] px-3 py-1.5 font-medium text-[var(--ink)] hover:bg-[var(--amber-hover)]"
          >
            Add a listing
          </Link>
        </nav>
      </div>
    </header>
  );
}
