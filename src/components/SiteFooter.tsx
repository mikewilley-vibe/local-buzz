import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";

const linkClassName =
  "rounded-sm text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 outline-none ring-[var(--amber)] hover:text-[var(--amber-deep)] focus-visible:ring-2";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} {PRODUCT_NAME}
        </p>
        <nav aria-label="Legal" className="flex gap-4">
          <Link href="/privacy" className={linkClassName}>
            Privacy
          </Link>
          <Link href="/support" className={linkClassName}>
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
