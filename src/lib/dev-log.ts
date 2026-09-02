export function logDevOperationError(operation: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown };
    const code = record.code == null ? "" : String(record.code);
    const message = record.message == null ? "" : String(record.message);
    console.error(`[Local Buzz] ${operation} failed`, code, message);
    return;
  }

  console.error(`[Local Buzz] ${operation} failed`);
}
