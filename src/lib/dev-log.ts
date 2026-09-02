export function logDevOperationError(operation: string, error: unknown) {
  logDevIssue(operation, error);
}

/** Expected auth failures. Use warn so Next.js does not open the error overlay. */
export function logDevAuthIssue(operation: string, error: unknown) {
  logDevIssue(operation, error);
}

function logDevIssue(operation: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown };
    const code = record.code == null ? "" : String(record.code);
    const message = record.message == null ? "" : String(record.message);
    console.warn(`[Local Buzz] ${operation} failed`, code, message);
    return;
  }

  console.warn(`[Local Buzz] ${operation} failed`);
}
