/**
 * GET /api/admin/usage — per-account LLM usage & cost rollup for the admin
 * panel. Guarded by ADMIN_TOKEN env (server-side; the client panel prompts
 * for it once and keeps it in sessionStorage).
 */

import { NextRequest } from "next/server";
import { getUsageSummary } from "@/lib/usage-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminToken(): string {
  return process.env.ADMIN_TOKEN?.trim() || "";
}

export function isAdminEnabled(): boolean {
  return Boolean(adminToken());
}

export async function GET(req: NextRequest) {
  if (!isAdminEnabled()) {
    return Response.json(
      { ok: false, error: "Admin panel disabled (ADMIN_TOKEN not set)." },
      { status: 503 },
    );
  }
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expected = adminToken();
  if (!expected || token !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const summary = await getUsageSummary();
  return Response.json({ ok: true, ...summary });
}
