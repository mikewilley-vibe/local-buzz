export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;

export const POINT_EVENT_LABELS = {
  listing_approved: "Listing approved",
  listing_confirmed: "Someone confirmed your listing",
} as const;

export const POINT_EVENT_DELTAS = {
  listing_approved: "+5",
  listing_confirmed: "+1",
} as const;

export type PointEventType = keyof typeof POINT_EVENT_LABELS;

export function isPointEventType(value: string): value is PointEventType {
  return value in POINT_EVENT_LABELS;
}

export function parseDisplayName(
  value: string,
): { error: string } | { displayName: string } {
  const displayName = value.trim().replace(/\s+/g, " ");
  if (
    displayName.length < DISPLAY_NAME_MIN ||
    displayName.length > DISPLAY_NAME_MAX
  ) {
    return {
      error: `Please choose a display name between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters.`,
    };
  }

  return { displayName };
}

export function parseEmailAddress(
  value: string,
): { error: string } | { email: string } {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: "Please enter a valid email address." };
  }

  return { email };
}

export function displayNameFromMetadata(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const record = data as { display_name?: unknown };
  return typeof record.display_name === "string" ? record.display_name : "";
}

export function isEmailInUseError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "identity_already_exists" ||
    code === "email_exists" ||
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("email address has already been") ||
    (message.includes("identity") && message.includes("exist"))
  );
}

export function eventPoints(eventType: string, points: number | null | undefined) {
  const value = Number(points);
  if (Number.isFinite(value) && value !== 0) return value;
  if (eventType === "listing_approved") return 5;
  if (eventType === "listing_confirmed") return 1;
  return 0;
}
