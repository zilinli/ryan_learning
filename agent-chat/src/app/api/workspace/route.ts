import { NextRequest, NextResponse } from "next/server";
import { scanDirectory } from "@/lib/workspace";

const DEFAULT_WORKSPACE = "/root/codes/ryan_learning";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dirPath = searchParams.get("path") || DEFAULT_WORKSPACE;

    const tree = scanDirectory(dirPath);
    return NextResponse.json(tree);
  } catch (err) {
    if (err instanceof Error && err.message === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to scan directory", detail: String(err) },
      { status: 500 }
    );
  }
}
