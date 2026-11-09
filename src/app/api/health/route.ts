import { liveSystemStatus } from "@/lib/system-status-live";

/**
 * For uptime monitors: 200 while the service works, 503 when a part is down. Levels only,
 * no numbers. Point an external monitor (e.g. UptimeRobot, Better Stack) at /api/health.
 */
export async function GET() {
  const s = await liveSystemStatus();
  return Response.json(
    { status: s.overall, checkedAt: s.checkedAt.toISOString(), components: Object.fromEntries(s.components.map((c) => [c.key, c.level])) },
    { status: s.overall === "down" ? 503 : 200, headers: { "cache-control": "no-store" } },
  );
}
