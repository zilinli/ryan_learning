import { NextRequest, NextResponse } from "next/server";
import { readFileContents } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");
  const encoding = searchParams.get("encoding") || "utf8";

  if (!filePath) {
    return NextResponse.json({ error: "Path parameter is required" }, { status: 400 });
  }

  try {
    const content = readFileContents(filePath);
    return NextResponse.json(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (msg === "FILE_TOO_LARGE") {
      return NextResponse.json(
        { error: "File too large (max 1MB)" },
        { status: 413 }
      );
    }
    if (msg === "Cannot read files in node_modules or .git") {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to read file", detail: msg },
      { status: 500 }
    );
  }
}
