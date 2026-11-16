import { getHealth } from "@rsos/db/health";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check (RSOS-099): environment, commit, database, the service key's project, and each
 * third-party adapter as real, fake or missing. Never any values.
 */
export async function GET() {
  const health = await getHealth("admin");
  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
