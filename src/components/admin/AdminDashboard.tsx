"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { checkIsAdministrator } from "@/lib/admin";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PendingListingsPanel } from "./PendingListingsPanel";
import { PendingReportsPanel } from "./PendingReportsPanel";

type Gate = "loading" | "forbidden" | "ready";
type Tab = "listings" | "reports";

export function AdminDashboard() {
  const router = useRouter();
  const tabId = useId();
  const [gate, setGate] = useState<Gate>("loading");
  const [tab, setTab] = useState<Tab>("listings");
  const [listingCount, setListingCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function gateAccess() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || user.is_anonymous) {
          if (!cancelled) router.replace("/admin/login");
          return;
        }

        const { isAdmin } = await checkIsAdministrator(supabase, user.id);

        if (cancelled) return;

        setGate(isAdmin ? "ready" : "forbidden");
      } catch {
        if (!cancelled) router.replace("/admin/login");
      }
    }

    void gateAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Still leave the dashboard.
    }
    router.replace("/admin/login");
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
  const listingsPanelId = `${tabId}-listings-panel`;
  const reportsPanelId = `${tabId}-reports-panel`;

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
            Review pending listings and change reports.
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
        className="flex flex-col gap-2 sm:flex-row"
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const next = tab === "listings" ? "reports" : "listings";
          setTab(next);
          requestAnimationFrame(() => {
            document
              .getElementById(next === "listings" ? listingsTabId : reportsTabId)
              ?.focus();
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
    </div>
  );
}
