import { collectScoutSources } from "@/lib/scout/collector";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expectedSecret = process.env.SCOUT_COLLECTOR_SECRET;
  const providedSecret = request.headers.get("x-scout-collector-secret");

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json().catch(() => ({}));
    const sourceIds =
      body && typeof body === "object" && Array.isArray((body as { sourceIds?: unknown }).sourceIds)
        ? (body as { sourceIds: unknown[] }).sourceIds.filter(
            (sourceId): sourceId is string => typeof sourceId === "string",
          )
        : undefined;

    return Response.json(await collectScoutSources(sourceIds));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Collector failed" },
      { status: 503 },
    );
  }
}

