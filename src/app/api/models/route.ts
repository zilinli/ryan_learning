import { hasCursorApiKey, listAvailableModels } from "@/lib/cursor-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasCursorApiKey()) {
    return Response.json(
      {
        error: "尚未配置 Cursor API Key。",
      },
      { status: 503 },
    );
  }

  try {
    const models = await listAvailableModels();
    return Response.json({
      models: models.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        description: m.description,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "无法列出模型";
    return Response.json({ error: msg }, { status: 500 });
  }
}
