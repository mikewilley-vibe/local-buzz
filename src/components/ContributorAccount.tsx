"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  accountEmailRedirectTo,
  completeAuthReturn,
} from "@/lib/auth-return";
import {
  DISPLAY_NAME_MAX,
  POINT_EVENT_DELTAS,
  POINT_EVENT_LABELS,
  displayNameFromMetadata,
  eventPoints,
  isEmailInUseError,
  isPointEventType,
  parseDisplayName,
  parseEmailAddress,
} from "@/lib/contributor";
import { logDevAuthIssue, logDevOperationError } from "@/lib/dev-log";
import {
  ACCOUNT_SESSION_ERROR,
  createSupabaseBrowserClient,
  ensureAnonymousSession,
  isAuthSessionMissing,
} from "@/lib/supabase/client";
import { formatDisplayDate } from "@/lib/week";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const CHECK_EMAIL_KEY = "local-buzz-check-email";
const fieldClassName =
  "min-h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2";
const buttonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60";
const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--wash)] focus-visible:ring-2 disabled:opacity-60";

type Gate = "loading" | "none" | "anonymous" | "check-email" | "signed-in";

type PointEventView = {
  id: string;
  eventType: string;
  points: number;
  createdAt: string;
  listingName: string | null;
};

type ContributorView = {
  displayName: string;
  needsName: boolean;
  total: number;
  approvedCount: number;
  confirmationCount: number;
  history: PointEventView[];
};

type Conflict = {
  email: string;
} | null;

function isPermanentUser(user: User | null) {
  return Boolean(user && !user.is_anonymous);
}

function readCheckEmail() {
  try {
    return sessionStorage.getItem(CHECK_EMAIL_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCheckEmail(on: boolean) {
  try {
    if (on) sessionStorage.setItem(CHECK_EMAIL_KEY, "1");
    else sessionStorage.removeItem(CHECK_EMAIL_KEY);
  } catch {
    // Ignore private-mode storage failures.
  }
}

async function loadContributor(user: User): Promise<ContributorView> {
  const supabase = createSupabaseBrowserClient();
  const metadataName = parseDisplayName(
    displayNameFromMetadata(user.user_metadata),
  );

  const { data: existing, error: profileError } = await supabase
    .from("contributor_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    logDevOperationError("load contributor profile", profileError);
    throw new Error(GENERIC_ERROR);
  }

  let nextName = existing?.display_name?.trim() ?? "";
  let needsName = false;

  if (!existing) {
    if ("error" in metadataName) {
      needsName = true;
    } else {
      const { error: insertError } = await supabase
        .from("contributor_profiles")
        .insert({
          user_id: user.id,
          display_name: metadataName.displayName,
        });

      if (insertError && insertError.code !== "23505") {
        logDevOperationError("create contributor profile", insertError);
        throw new Error(GENERIC_ERROR);
      }

      nextName = metadataName.displayName;
    }
  } else if (nextName.length === 0) {
    needsName = true;
  }

  const { data: eventRows, error: eventsError } = await supabase
    .from("point_events")
    .select("id, event_type, points, created_at, listing_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (eventsError) {
    logDevOperationError("load point events", eventsError);
    throw new Error(GENERIC_ERROR);
  }

  const rows = (eventRows ?? []) as {
    id: string;
    event_type: string | null;
    points: number | null;
    created_at: string | null;
    listing_id: string | null;
  }[];

  const listingIds = [
    ...new Set(rows.map((row) => row.listing_id).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();

  if (listingIds.length > 0) {
    const { data: listingRows, error: listingError } = await supabase
      .from("listings")
      .select("id, place_name")
      .in("id", listingIds);

    if (listingError) {
      logDevOperationError("load point event listings", listingError);
    } else {
      for (const listing of listingRows ?? []) {
        if (listing.id && listing.place_name) {
          names.set(listing.id, listing.place_name);
        }
      }
    }
  }

  const history = rows.map((row) => {
    const eventType = row.event_type ?? "";
    return {
      id: row.id,
      eventType,
      points: eventPoints(eventType, row.points),
      createdAt: row.created_at ?? "",
      listingName: row.listing_id ? names.get(row.listing_id) ?? null : null,
    };
  });

  return {
    displayName: nextName,
    needsName,
    total: history.reduce((sum, event) => sum + event.points, 0),
    approvedCount: history.filter((event) => event.eventType === "listing_approved")
      .length,
    confirmationCount: history.filter(
      (event) => event.eventType === "listing_confirmed",
    ).length,
    history,
  };
}

export function ContributorAccount() {
  const nameId = useId();
  const emailId = useId();
  const [gate, setGate] = useState<Gate>("loading");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<string | null>(null);
  const pending = Boolean(pendingKind);
  const [conflict, setConflict] = useState<Conflict>(null);
  const [contributor, setContributor] = useState<ContributorView | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const supabase = createSupabaseBrowserClient();
        await completeAuthReturn(supabase);
        if (cancelled) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        const sessionUser = session?.user ?? null;

        if (isPermanentUser(sessionUser) && sessionUser) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (cancelled) return;
          const permanent = user && isPermanentUser(user) ? user : sessionUser;
          writeCheckEmail(false);
          const view = await loadContributor(permanent);
          if (cancelled) return;
          setContributor(view);
          setDisplayName(view.displayName);
          setGate("signed-in");
          return;
        }

        if (sessionUser?.is_anonymous) {
          setGate(readCheckEmail() ? "check-email" : "anonymous");
          return;
        }

        setGate(readCheckEmail() ? "check-email" : "none");
      } catch (error) {
        logDevOperationError("load contributor account", error);
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : GENERIC_ERROR,
          );
          setGate("none");
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  async function startAccount() {
    setErrorMessage(null);
    setPendingKind("start");
    try {
      const { session, user } = await ensureAnonymousSession();
      if (!session || !user) {
        setErrorMessage(ACCOUNT_SESSION_ERROR);
        return;
      }
      setGate("anonymous");
    } catch (error) {
      logDevAuthIssue("start contributor account", error);
      setErrorMessage(ACCOUNT_SESSION_ERROR);
    } finally {
      setPendingKind(null);
    }
  }

  async function sendSignInLink(nextEmail: string) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: accountEmailRedirectTo(),
      },
    });

    if (error) {
      logDevAuthIssue("send sign-in link", error);
    }

    writeCheckEmail(true);
    setStatusMessage(
      "If that email has a contributor account, we sent a sign-in link.",
    );
    setGate("check-email");
  }

  async function onExistingSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const parsed = parseEmailAddress(email);
    if ("error" in parsed) {
      setErrorMessage(parsed.error);
      return;
    }

    setPendingKind("signin");
    try {
      await sendSignInLink(parsed.email);
    } catch (error) {
      logDevAuthIssue("existing contributor sign-in", error);
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setPendingKind(null);
    }
  }

  async function onUpgrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setConflict(null);

    const name = parseDisplayName(displayName);
    const address = parseEmailAddress(email);
    if ("error" in name) {
      setErrorMessage(name.error);
      return;
    }
    if ("error" in address) {
      setErrorMessage(address.error);
      return;
    }

    setPendingKind("upgrade");
    try {
      const supabase = createSupabaseBrowserClient();
      let access = await ensureAnonymousSession();
      if (!access.session || !access.user) {
        setErrorMessage(ACCOUNT_SESSION_ERROR);
        return;
      }

      const attributes = {
        email: address.email,
        data: { display_name: name.displayName },
      };
      const options = { emailRedirectTo: accountEmailRedirectTo() };

      let { error } = await supabase.auth.updateUser(attributes, options);

      if (isAuthSessionMissing(error)) {
        logDevAuthIssue("link contributor email", error);
        access = await ensureAnonymousSession();
        if (!access.session || !access.user) {
          setErrorMessage(ACCOUNT_SESSION_ERROR);
          return;
        }
        ({ error } = await supabase.auth.updateUser(attributes, options));
      }

      if (error) {
        if (isEmailInUseError(error)) {
          setConflict({ email: address.email });
          setErrorMessage(
            "That email is already used with another contributor account.",
          );
          return;
        }
        logDevAuthIssue("link contributor email", error);
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      writeCheckEmail(true);
      setStatusMessage(
        "Check your email to finish setting up your contributor account.",
      );
      setGate("check-email");
    } catch (error) {
      if (isAuthSessionMissing(error)) {
        logDevAuthIssue("link contributor email", error);
        setErrorMessage(ACCOUNT_SESSION_ERROR);
        return;
      }
      logDevAuthIssue("link contributor email", error);
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setPendingKind(null);
    }
  }

  async function continueWithExistingAccount() {
    if (!conflict) return;
    setErrorMessage(null);
    setPendingKind("conflict");
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      await sendSignInLink(conflict.email);
      setConflict(null);
    } catch (error) {
      logDevAuthIssue("switch to existing contributor", error);
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setPendingKind(null);
    }
  }

  async function onSaveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const parsed = parseDisplayName(displayName);
    if ("error" in parsed) {
      setErrorMessage(parsed.error);
      return;
    }

    setPendingKind("save");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.is_anonymous) {
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: parsed.displayName },
      });
      if (authError) {
        logDevAuthIssue("update display name metadata", authError);
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      const { data, error } = await supabase
        .from("contributor_profiles")
        .upsert(
          { user_id: user.id, display_name: parsed.displayName },
          { onConflict: "user_id" },
        )
        .select("display_name")
        .maybeSingle();

      if (error) {
        logDevOperationError("update contributor profile", error);
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      setContributor((current) =>
        current
          ? {
              ...current,
              displayName: data?.display_name ?? parsed.displayName,
              needsName: false,
            }
          : current,
      );
      setStatusMessage("Display name updated.");
    } catch (error) {
      logDevOperationError("update display name", error);
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setPendingKind(null);
    }
  }

  async function signOut() {
    setPendingKind("signout");
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      writeCheckEmail(false);
      setContributor(null);
      setDisplayName("");
      setEmail("");
      setConflict(null);
      setStatusMessage(null);
      setGate("none");
    } catch (error) {
      logDevAuthIssue("contributor sign out", error);
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setPendingKind(null);
    }
  }

  if (gate === "loading") {
    return (
      <p className="text-sm text-[var(--muted)]" role="status">
        Loading your contributor account…
      </p>
    );
  }

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          Contributors
        </p>
        <h1 className="mt-2 font-display text-4xl text-[var(--ink)]">
          My points
        </h1>
      </div>

      {statusMessage ? (
        <p
          className="rounded-xl border border-[var(--line)] bg-[var(--wash)] px-4 py-3 text-sm text-[var(--ink)]"
          role="status"
        >
          {statusMessage}
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

      {gate === "none" ? (
        <div className="grid gap-5">
          <p className="text-[var(--muted)]">
            Submit useful Hampton Roads listings and earn points when they are
            approved and when neighbors confirm they are still accurate.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void startAccount()}
            className={buttonClassName}
          >
            {pendingKind === "start" ? "Starting…" : "Create contributor account"}
          </button>
          <ExistingSignIn
            emailId={emailId}
            email={email}
            pending={pending}
            pendingKind={pendingKind}
            onEmailChange={setEmail}
            onSubmit={(event) => void onExistingSignIn(event)}
          />
        </div>
      ) : null}

      {gate === "anonymous" ? (
        <div className="grid gap-5">
          <p className="text-[var(--muted)]">
            You already have a temporary Local Buzz session. Linking your email
            keeps that activity, including listings you submitted before creating
            a visible account.
          </p>
          <form className="grid gap-4" onSubmit={(event) => void onUpgrade(event)}>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-[var(--ink)]">
                Display name
              </span>
              <input
                id={nameId}
                name="displayName"
                required
                minLength={2}
                maxLength={DISPLAY_NAME_MAX}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
                className={fieldClassName}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-[var(--ink)]">Email</span>
              <input
                id={emailId}
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className={fieldClassName}
              />
            </label>
            <button type="submit" disabled={pending} className={buttonClassName}>
              {pendingKind === "upgrade" ? "Sending…" : "Send verification email"}
            </button>
          </form>
          {conflict ? (
            <div className="grid gap-3">
              <p className="text-sm text-[var(--muted)]">
                You can sign out of this temporary session and we will email a
                sign-in link to the existing account.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => void continueWithExistingAccount()}
                className={secondaryButtonClassName}
              >
                {pendingKind === "conflict" ? "Sending…" : "Email a sign-in link to that account"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {gate === "check-email" ? (
        <div className="grid gap-4">
          <p className="text-[var(--muted)]">
            Check your email and open the Local Buzz link on this device to
            finish signing in. The link returns you here.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              writeCheckEmail(false);
              setStatusMessage(null);
              setPendingKind("reset");
              void (async () => {
                try {
                  const supabase = createSupabaseBrowserClient();
                  const {
                    data: { session },
                  } = await supabase.auth.getSession();
                  setGate(
                    session?.user?.is_anonymous ? "anonymous" : "none",
                  );
                } catch (error) {
                  logDevAuthIssue("reset contributor email step", error);
                  setGate("none");
                } finally {
                  setPendingKind(null);
                }
              })();
            }}
            className={secondaryButtonClassName}
          >
            Use a different email
          </button>
        </div>
      ) : null}

      {gate === "signed-in" && contributor ? (
        <div className="grid gap-6">
          <p className="text-[var(--muted)]">
            Thanks for helping neighbors find what’s going on this week.
          </p>

          <dl className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:p-5">
            <div>
              <dt className="text-sm font-medium text-[var(--ink)]">Total points</dt>
              <dd className="mt-1 font-display text-3xl text-[var(--ink)]">
                {contributor.total}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-[var(--ink)]">
                Approved submissions
              </dt>
              <dd className="mt-1 text-sm text-[var(--muted)]">
                {contributor.approvedCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-[var(--ink)]">
                Confirmations received
              </dt>
              <dd className="mt-1 text-sm text-[var(--muted)]">
                {contributor.confirmationCount}
              </dd>
            </div>
          </dl>

          <form className="grid gap-3" onSubmit={(event) => void onSaveName(event)}>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-[var(--ink)]">
                Display name
              </span>
              <input
                name="displayName"
                required
                minLength={2}
                maxLength={DISPLAY_NAME_MAX}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
                className={fieldClassName}
              />
            </label>
            {contributor.needsName ? (
              <p className="text-sm text-[var(--muted)]">
                Choose a display name to finish your profile.
              </p>
            ) : null}
            <button type="submit" disabled={pending} className={buttonClassName}>
              {pendingKind === "save" ? "Saving…" : "Save display name"}
            </button>
          </form>

          <section className="grid gap-3" aria-labelledby="points-history-heading">
            <h2
              id="points-history-heading"
              className="font-display text-2xl text-[var(--ink)]"
            >
              Activity
            </h2>
            {contributor.history.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No points yet. Approved listings and neighbor confirmations will
                show up here.
              </p>
            ) : (
              <ol className="grid gap-2">
                {contributor.history.map((event) => {
                  const label = isPointEventType(event.eventType)
                    ? POINT_EVENT_LABELS[event.eventType]
                    : "Points earned";
                  const delta = isPointEventType(event.eventType)
                    ? POINT_EVENT_DELTAS[event.eventType]
                    : `+${event.points}`;
                  const when = event.createdAt
                    ? formatDisplayDate(event.createdAt)
                    : null;

                  return (
                    <li
                      key={event.id}
                      className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-[var(--ink)]">{label}</p>
                          {event.listingName ? (
                            <p className="mt-0.5 text-sm text-[var(--muted)]">
                              {event.listingName}
                            </p>
                          ) : null}
                          {when ? (
                            <p className="mt-0.5 text-sm text-[var(--muted)]">{when}</p>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium text-[var(--amber-deep)]">
                          {delta}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <button
            type="button"
            disabled={pending}
            onClick={() => void signOut()}
            className={secondaryButtonClassName}
          >
            {pendingKind === "signout" ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ExistingSignIn({
  emailId,
  email,
  pending,
  pendingKind,
  onEmailChange,
  onSubmit,
}: {
  emailId: string;
  email: string;
  pending: boolean;
  pendingKind: string | null;
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <p className="text-sm text-[var(--muted)]">
        Already have an account? Email me a sign-in link.
      </p>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[var(--ink)]">Email</span>
        <input
          id={`${emailId}-existing`}
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          autoComplete="email"
          className={fieldClassName}
        />
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClassName}>
        {pendingKind === "signin" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
