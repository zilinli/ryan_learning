import { NextRequest, NextResponse } from "next/server";

const STT_SERVER_URL = "http://localhost:8765/transcribe";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const sttFormData = new FormData();
    sttFormData.append("audio", audioFile, "recording.wav");
    const language = formData.get("language");
    if (typeof language === "string" && language) {
      sttFormData.append("language", language);
    }

    // Forward to local STT server
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(STT_SERVER_URL, {
      method: "POST",
      body: sttFormData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      return NextResponse.json(
        { error: `STT server returned ${resp.status}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    return NextResponse.json({
      text: data.text || data.transcript || "",
      language: data.language || "auto",
      confidence: data.confidence || 0.8,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "STT server timeout" }, { status: 504 });
    }
    return NextResponse.json(
      { error: "STT server unavailable", detail: String(err) },
      { status: 502 }
    );
  }
}
