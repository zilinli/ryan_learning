import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "spark-acc",
    version: "0.1.0",
    status: "healthy",
    uptimeSec: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
}
