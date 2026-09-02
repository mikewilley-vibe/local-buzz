"use client";

import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { logDevAuthIssue } from "@/lib/dev-log";

let browserClient: SupabaseClient | null = null;
let anonymousSignIn: Promise<AnonymousSessionResult> | null = null;

export const ACCOUNT_SESSION_ERROR =
  "Couldn’t start a contributor session. Please try again.";

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured.");
  }

  browserClient = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return browserClient;
}

export type AnonymousSessionResult = {
  supabase: SupabaseClient;
  user: User | null;
  session: Session | null;
};

function hasUsableSession(session: Session | null | undefined): session is Session {
  return Boolean(session?.access_token && session.user);
}

export function isAuthSessionMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { name?: unknown; message?: unknown; code?: unknown };
  const name = String(record.name ?? "");
  const message = String(record.message ?? "");
  const code = String(record.code ?? "");
  return (
    name === "AuthSessionMissingError" ||
    message === "Auth session missing!" ||
    code === "session_not_found"
  );
}

async function readSession(supabase: SupabaseClient) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return hasUsableSession(session) ? session : null;
}

async function waitForPersistedSession(supabase: SupabaseClient, userId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const session = await readSession(supabase);
    if (session && session.user.id === userId) return session;
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
  }
  return readSession(supabase);
}

async function signInAnonymouslyOnce(
  supabase: SupabaseClient,
): Promise<AnonymousSessionResult> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user || !hasUsableSession(data.session)) {
    logDevAuthIssue(
      "anonymous sign in",
      error ?? { message: "anonymous sign-in returned no session" },
    );
    return { supabase, user: null, session: null };
  }

  const persisted = await waitForPersistedSession(supabase, data.user.id);
  if (!persisted) {
    logDevAuthIssue("anonymous session persist", {
      message: "getSession empty after anonymous sign-in",
    });
    return { supabase, user: null, session: null };
  }

  return { supabase, user: persisted.user, session: persisted };
}

export async function ensureAnonymousSession(): Promise<AnonymousSessionResult> {
  const supabase = createSupabaseBrowserClient();
  const session = await readSession(supabase);
  if (session) {
    return { supabase, user: session.user, session };
  }

  if (!anonymousSignIn) {
    anonymousSignIn = signInAnonymouslyOnce(supabase).finally(() => {
      anonymousSignIn = null;
    });
  }

  return anonymousSignIn;
}

export async function ensureAnonymousUser() {
  const { supabase, user } = await ensureAnonymousSession();
  return { supabase, userId: user?.id ?? null };
}
