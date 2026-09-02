import type { SupabaseClient, User } from "@supabase/supabase-js";
import { checkIsAdministrator } from "@/lib/admin";
import { logDevOperationError } from "@/lib/dev-log";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const GET_USER_MS = 5000;

export type AdminAccessKind = "none" | "anonymous" | "user" | "admin";

export type AdminAccess = {
  kind: AdminAccessKind;
  supabase: SupabaseClient;
  user: User | null;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(label));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readVerifiedUser(
  supabase: SupabaseClient,
  sessionUser: User,
) {
  try {
    const {
      data: { user },
      error,
    } = await withTimeout(
      supabase.auth.getUser(),
      GET_USER_MS,
      "admin getUser timed out",
    );

    if (error) {
      logDevOperationError("admin getUser", error);
      return sessionUser.is_anonymous ? null : sessionUser;
    }

    return user ?? sessionUser;
  } catch (error) {
    logDevOperationError("admin getUser", error);
    return sessionUser.is_anonymous ? null : sessionUser;
  }
}

export async function resolveAdminAccess(): Promise<AdminAccess> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    if (process.env.NODE_ENV === "development") {
      console.info("[Local Buzz] admin access", "none");
    }
    return { kind: "none", supabase, user: null };
  }

  if (session.user.is_anonymous) {
    if (process.env.NODE_ENV === "development") {
      console.info("[Local Buzz] admin access", "anonymous");
    }
    return { kind: "anonymous", supabase, user: session.user };
  }

  const user = await readVerifiedUser(supabase, session.user);
  if (!user || user.is_anonymous) {
    if (process.env.NODE_ENV === "development") {
      console.info("[Local Buzz] admin access", "anonymous");
    }
    return { kind: "anonymous", supabase, user };
  }

  const { isAdmin } = await checkIsAdministrator(supabase, user.id);
  const kind: AdminAccessKind = isAdmin ? "admin" : "user";

  if (process.env.NODE_ENV === "development") {
    console.info("[Local Buzz] admin access", kind);
  }

  return { kind, supabase, user };
}

export async function replaceSessionWithPassword(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      logDevOperationError("admin replace session sign out", signOutError);
    }
  }

  return supabase.auth.signInWithPassword({ email, password });
}
