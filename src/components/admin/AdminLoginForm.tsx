"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { checkIsAdministrator } from "@/lib/admin";
import { logDevOperationError } from "@/lib/dev-log";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const GENERIC_ERROR = "Couldn’t sign in. Please try again.";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function redirectIfAdmin() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user || session.user.is_anonymous) {
          if (!cancelled) setChecking(false);
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!user || user.is_anonymous || userError) {
          if (userError) logDevOperationError("admin login session check", userError);
          if (!cancelled) setChecking(false);
          return;
        }

        const { isAdmin } = await checkIsAdministrator(supabase, user.id);
        if (!cancelled && isAdmin) {
          router.replace("/admin");
          return;
        }
      } catch (error) {
        logDevOperationError("admin login session check", error);
      }

      if (!cancelled) setChecking(false);
    }

    void redirectIfAdmin();

    return () => {
      cancelled = true;
    };
    // Run once. Re-running when `router` changes can cancel getUser and
    // leave this screen on “Checking sign-in…”.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const nextEmail = email.trim();
    if (!nextEmail || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: nextEmail,
        password,
      });

      setPassword("");

      if (error || !data.user) {
        logDevOperationError("admin sign in", error);
        setErrorMessage(GENERIC_ERROR);
        return;
      }

      await checkIsAdministrator(supabase, data.user.id);
      router.replace("/admin");
    } catch (error) {
      logDevOperationError("admin sign in", error);
      setPassword("");
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (checking) {
    return (
      <p className="text-sm text-[var(--muted)]" role="status">
        Checking sign-in…
      </p>
    );
  }

  return (
    <div className="mx-auto grid max-w-md gap-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          Staff
        </p>
        <h1 className="mt-2 font-display text-4xl text-[var(--ink)]">
          Admin sign in
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Sign in to review pending listings and change reports.
        </p>
      </div>

      <form className="grid gap-5" onSubmit={(event) => void onSubmit(event)}>
        {errorMessage ? (
          <p
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[var(--ink)] outline-none ring-[var(--amber)] focus:ring-2"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--amber)] px-5 py-3 font-medium text-[var(--ink)] outline-none ring-[var(--amber)] hover:bg-[var(--amber-hover)] focus-visible:ring-2 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
