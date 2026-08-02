import { promises as fs } from "node:fs";
import path from "node:path";
import { hasCursorApiKey } from "@/lib/cursor-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV_PATH = path.join(process.cwd(), ".env.local");

export async function GET() {
  return Response.json({
    configured: hasCursorApiKey(),
    dashboardUrl: "https://cursor.com/dashboard/integrations",
  });
}

export async function POST(req: Request) {
  let body: { apiKey?: string };
  try {
    body = (await req.json()) as { apiKey?: string };
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = body.apiKey?.trim();
  if (
    !apiKey ||
    !(apiKey.startsWith("cursor_") || apiKey.startsWith("crsr_"))
  ) {
    return Response.json(
      { error: "Paste a Cursor API Key starting with cursor_ or crsr_" },
      { status: 400 },
    );
  }

  let existing = "";
  try {
    existing = await fs.readFile(ENV_PATH, "utf8");
  } catch {
    existing = "";
  }

  const lines = existing
    ? existing.split(/\r?\n/).filter((line) => !line.startsWith("CURSOR_API_KEY="))
    : [];
  lines.push(`CURSOR_API_KEY=${apiKey}`);
  const next = `${lines.filter(Boolean).join("\n")}\n`;
  await fs.writeFile(ENV_PATH, next, "utf8");

  // 当前进程立刻生效，无需重启
  process.env.CURSOR_API_KEY = apiKey;

  return Response.json({ ok: true });
}
