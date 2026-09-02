"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { checkIsAdministrator } from "@/lib/admin";
import { logDevOperationError } from "@/lib/dev-log";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PendingListingsPanel } from "./PendingListingsPanel";
import { PendingReportsPanel } from "./PendingReportsPanel";
import { NeedsVerificationPanel } from "./NeedsVerificationPanel";

type Gate = "loading" | "forbidden" | "ready";
type Tab = "listings" | "reports" | "verification";

const TABS: Tab[] = ["listings", "reports", "verification"];

export function AdminDashboard() {
  const router = useRouter();
  const tabId = useId();
  const [gate, setGate] = useState<Gate>("loading");
  const [tab, setTab] = useState<Tab>("listings");
  const [listingCount, setListingCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [verificationCount, setVerificationCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function gateAccess() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session?.user || session.user.is_anonymous) {
          router.replace("/admin/login");
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError || !user || user.is_anonymous) {
          logDevOperationError("admin dashboard access check", userError);
          router.replace("/admin/login");
          return;
        }

        const { isAdmin } = await checkIsAdministrator(supabase, user.id);

        if (cancelled) return;

        setGate(isAdmin ? "ready" : "forbidden");
      } catch (error) {
        logDevOperationError("admin dashboard access check", error);
        if (!cancelled) router.replace("/admin/login");
      }
    }

    void gateAccess();

    return () => {
      cancelled = true;
    };
    // Run once. Re-running when `router` changes cancels getUser and can
    // leave this screen on “Checking administrator access…”.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch (error) {
      logDevOperationError("admin sign out", error);
    } finally {
      router.replace("/admin/login");
    }
  }

  if (gate === "loading") {
    return (
      <p className="text-sm text-[var(--muted)]" role="status">
        Checking administrator access…
      </p>
    );
  }

  if (gate === "forbidden") {
    return (
      <div className="mx-auto grid max-w-lg gap-4">
        <h1 className="font-display text-4xl text-[var(--ink)]">Admin</h1>
        <p className="text-[var(--muted)]" role="status">
          You do not have administrator access
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60 sm:w-auto"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

  const listingsTabId = `${tabId}-listings`;
  const reportsTabId = `${tabId}-reports`;
  const verificationTabId = `${tabId}-verification`;
  const listingsPanelId = `${tabId}-listings-panel`;
  const reportsPanelId = `${tabId}-reports-panel`;
  const verificationPanelId = `${tabId}-verification-panel`;

  function tabButtonId(next: Tab) {
    if (next === "listings") return listingsTabId;
    if (next === "reports") return reportsTabId;
    return verificationTabId;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
            Moderation
          </p>
          <h1 className="mt-2 font-display text-4xl text-[var(--ink)]">
            Admin dashboard
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Review pending listings, change reports, and listings that need verification.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Moderation queues"
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const index = TABS.indexOf(tab);
          const offset = event.key === "ArrowRight" ? 1 : -1;
          const next = TABS[(index + offset + TABS.length) % TABS.length];
          setTab(next);
          requestAnimationFrame(() => {
            document.getElementById(tabButtonId(next))?.focus();
          });
        }}
      >
        <button
          id={listingsTabId}
          type="button"
          role="tab"
          aria-selected={tab === "listings"}
          aria-controls={listingsPanelId}
          tabIndex={tab === "listings" ? 0 : -1}
          onClick={() => setTab("listings")}
          className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium outline-none ring-[var(--amber)] focus-visible:ring-2 ${
            tab === "listings"
              ? "bg-[var(--amber)] text-[var(--ink)]"
              : "border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--wash)]"
          }`}
        >
          Pending listings ({listingCount})
        </button>
        <button
          id={reportsTabId}
          type="button"
          role="tab"
          aria-selected={tab === "reports"}
          aria-controls={reportsPanelId}
          tabIndex={tab === "reports" ? 0 : -1}
          onClick={() => setTab("reports")}
          className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium outline-none ring-[var(--amber)] focus-visible:ring-2 ${
            tab === "reports"
              ? "bg-[var(--amber)] text-[var(--ink)]"
              : "border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--wash)]"
          }`}
        >
          Change reports ({reportCount})
        </button>
        <button
          id={verificationTabId}
          type="button"
          role="tab"
          aria-selected={tab === "verification"}
          aria-controls={verificationPanelId}
          tabIndex={tab === "verification" ? 0 : -1}
          onClick={() => setTab("verification")}
          className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium outline-none ring-[var(--amber)] focus-visible:ring-2 ${
            tab === "verification"
              ? "bg-[var(--amber)] text-[var(--ink)]"
              : "border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--wash)]"
          }`}
        >
          Needs verification ({verificationCount})
        </button>
      </div>

      <div
        id={listingsPanelId}
        role="tabpanel"
        aria-labelledby={listingsTabId}
        hidden={tab !== "listings"}
      >
        <PendingListingsPanel onCountChange={setListingCount} />
      </div>
      <div
        id={reportsPanelId}
        role="tabpanel"
        aria-labelledby={reportsTabId}
        hidden={tab !== "reports"}
      >
        <PendingReportsPanel onCountChange={setReportCount} />
      </div>
      <div
        id={verificationPanelId}
        role="tabpanel"
        aria-labelledby={verificationTabId}
        hidden={tab !== "verification"}
      >
        <NeedsVerificationPanel onCountChange={setVerificationCount} />
      </div>
    </div>
  );
}
