"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logDevOperationError } from "@/lib/dev-log";

export function accountEmailRedirectTo() {
  return `${window.location.origin}/account`;
}

export async function completeAuthReturn(supabase: SupabaseClient) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (authError) {
    logDevOperationError("auth return", { message: authError });
    url.searchParams.delete("code");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    url.searchParams.delete("error_code");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    throw new Error("Couldn’t finish signing in. Please try the email link again.");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    url.searchParams.delete("code");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    if (error) {
      logDevOperationError("exchange auth code", error);
      throw new Error("Couldn’t finish signing in. Please try the email link again.");
    }
    return;
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  if (error) {
    logDevOperationError("set auth session from link", error);
    throw new Error("Couldn’t finish signing in. Please try the email link again.");
  }
}
