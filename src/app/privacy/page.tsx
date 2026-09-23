import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME, SUPPORT_EMAIL } from "@/lib/brand";

const LAST_UPDATED = "September 23, 2026";

export const metadata: Metadata = {
  title: `Privacy Policy — ${PRODUCT_NAME}`,
  description: `How ${PRODUCT_NAME} collects, uses, and shares information, and how to request deletion.`,
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto grid max-w-2xl gap-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          {PRODUCT_NAME}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Last updated {LAST_UPDATED}
        </p>
      </header>

      <div className="grid gap-8 text-base leading-relaxed text-[var(--ink)]">
        <p>
          {PRODUCT_NAME} is a Hampton Roads guide to happy hours, food
          specials, trivia, and events, on the website and in the mobile app.
          This policy explains what we collect, how we use it, and how to ask
          us to delete it.
        </p>
        <p>
          You can browse listings without an account. We ask for more
          information when you contribute, save an email, or open the map.
        </p>

        <section className="grid gap-3">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            Information we collect
          </h2>
          <p>
            <strong className="font-medium">Account email.</strong> If you
            create or sign in to an account, we collect your email address.
            The website sends a sign-in link. The mobile app sends a one-time
            code. Email is optional for browsing.
          </p>
          <p>
            <strong className="font-medium">Display name.</strong> On the
            website, a contributor account can include a display name. We show
            it on your account page. We do not put it on public listings.
          </p>
          <p>
            <strong className="font-medium">Account identifier.</strong> When
            you confirm a listing, report a problem, or submit a listing, we
            create or reuse an account id so those actions stay with you.
            Until you add an email, that account is anonymous. A session is
            stored on your device so you can stay signed in.
          </p>
          <p>
            <strong className="font-medium">Listings you submit.</strong> A
            submission can include the venue name, city, listing type, days,
            times, description, an optional source link, street address, and
            ZIP code. After review, venue details can appear on the public
            calendar. Your email is not shown with the listing.
          </p>
          <p>
            <strong className="font-medium">Reports and confirmations.</strong>{" "}
            If you tell us a listing is wrong, we store the reason, an
            optional note, and your account id. If you confirm a listing is
            still accurate, we store that confirmation and any contribution
            points connected to your account.
          </p>
          <p>
            <strong className="font-medium">Location.</strong> The mobile app
            asks for location permission while you use the map so the phone
            can turn a venue’s street address into a map pin. We do not read
            or store your device’s current location, and we do not track where
            you go. The website does not ask for device location. If you open
            directions, the venue address is sent to Apple Maps or Google
            Maps.
          </p>
          <p>
            <strong className="font-medium">Technical data.</strong> We do not
            add a separate analytics or advertising tool. Supabase, which
            stores accounts and listings, and Vercel, which hosts the website,
            may process basic technical data needed to run the service, such
            as IP address, device or browser type, and the time of a request.
            The mobile app is built with Expo. We do not use a separate Expo
            analytics product.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            How we use information
          </h2>
          <ul className="grid list-disc gap-2 pl-5">
            <li>Run {PRODUCT_NAME} and show listings</li>
            <li>Sign you in and keep your contributions with your account</li>
            <li>Review submissions and reports</li>
            <li>Place venue pins on the map</li>
            <li>
              Keep the service secure and understand basic usage so we can
              improve it
            </li>
          </ul>
          <p>We do not sell personal information.</p>
        </section>

        <section className="grid gap-3">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            Who we share information with
          </h2>
          <p>
            We share information with providers that help us run{" "}
            {PRODUCT_NAME}:
          </p>
          <ul className="grid list-disc gap-2 pl-5">
            <li>
              <strong className="font-medium">Supabase</strong> stores
              accounts, sessions, listings, reports, confirmations, and
              contribution points.
            </li>
            <li>
              <strong className="font-medium">Vercel</strong> hosts the
              website.
            </li>
            <li>
              <strong className="font-medium">Apple and Google</strong> when
              you download the app from the App Store or Google Play, when the
              phone’s map tools turn a venue address into a pin, or when you
              open directions in Apple Maps or Google Maps.
            </li>
          </ul>
          <p>
            We may also share information if the law requires it, or to protect{" "}
            {PRODUCT_NAME}, our users, or the public. We do not share personal
            information for advertising across other companies’ apps or
            websites.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            How long we keep information
          </h2>
          <p>
            We keep account information while your account is active and as
            long as we need it to operate {PRODUCT_NAME}. Venue listings that
            we approve may stay public because they describe a place.
          </p>
          <p>
            To delete your account or personal information, email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[var(--amber-deep)] underline underline-offset-4 outline-none ring-[var(--amber)] focus-visible:ring-2"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            from the address on the account and ask us to delete it. We will
            delete the email, display name, and other personal information we
            can tie to that account. We may keep a limited record if we need
            it for security, moderation, or a legal duty. Signing out removes
            the session on that device. It does not delete the account.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="font-display text-2xl text-[var(--ink)]">
            Children’s privacy
          </h2>
          <p>
            {PRODUCT_NAME} is not directed at children under 13, and we do not
            knowingly collect personal information from children under 13. If
            you believe a child has given us personal information, email us
            and we will delete it.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="font-display text-2xl text-[var(--ink)]">Contact</h2>
          <p>
            Privacy questions go to{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[var(--amber-deep)] underline underline-offset-4 outline-none ring-[var(--amber)] focus-visible:ring-2"
            >
              {SUPPORT_EMAIL}
            </a>
            . For help using {PRODUCT_NAME}, visit the{" "}
            <Link
              href="/support"
              className="text-[var(--amber-deep)] underline underline-offset-4 outline-none ring-[var(--amber)] focus-visible:ring-2"
            >
              support page
            </Link>
            .
          </p>
          <p>
            If this policy changes, we will update the date at the top of this
            page.
          </p>
        </section>
      </div>
    </article>
  );
}
