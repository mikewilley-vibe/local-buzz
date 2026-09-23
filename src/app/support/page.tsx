import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Support — ${PRODUCT_NAME}`,
  description: `Get help with ${PRODUCT_NAME}, including sign-in, listings, and App Store feedback.`,
};

const topics = [
  {
    title: "Signing in",
    body: "Browsing does not require an account. To keep contributions with you, add your email. The website sends a sign-in link. The app sends a one-time code. Check spam if it does not arrive, then request another.",
  },
  {
    title: "Adding a listing",
    body: "Use Add a listing on the website, or submit from the app. Include the venue, city, days, and what is happening. Community submissions are reviewed before they appear on the calendar.",
  },
  {
    title: "Incorrect listing",
    body: "Open the listing and send a report with what changed, or email us the venue name and what is wrong. We review reports before we update the public calendar.",
  },
  {
    title: "App Store and TestFlight",
    body: "Tell us what you were doing, what you expected, and what happened. A screenshot helps. Include the device and whether you are on TestFlight or the App Store.",
  },
] as const;

export default function SupportPage() {
  return (
    <article className="mx-auto grid max-w-2xl gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          {PRODUCT_NAME}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
          Support
        </h1>
        <p className="mt-3 text-lg text-[var(--ink)]">
          Need help with {PRODUCT_NAME}?
        </p>
        <p className="mt-3 leading-relaxed text-[var(--muted)]">
          Email us and we will help with your account, a listing, or the app.
          A reply may take 1–2 business days.
        </p>
      </header>

      <p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>

      <section className="grid gap-4">
        <h2 className="font-display text-2xl text-[var(--ink)]">
          Common topics
        </h2>
        <ul className="grid gap-3">
          {topics.map((topic) => (
            <li
              key={topic.title}
              className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-4 sm:px-5"
            >
              <h3 className="font-medium text-[var(--ink)]">{topic.title}</h3>
              <p className="mt-1 leading-relaxed text-[var(--muted)]">
                {topic.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="leading-relaxed text-[var(--ink)]">
        Read how we handle information in the{" "}
        <Link
          href="/privacy"
          className="text-[var(--amber-deep)] underline underline-offset-4 outline-none ring-[var(--amber)] focus-visible:ring-2"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </article>
  );
}
