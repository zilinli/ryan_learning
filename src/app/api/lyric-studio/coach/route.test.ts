import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: vi.fn(async () => {
      throw new Error("Agent disabled in unit tests");
    }),
  },
  CursorAgentError: class CursorAgentError extends Error {},
}));

const DRAFT = [
  "Morning light on the desk",
  "I fold the page I never finished",
  "The kettle clicks once",
  "And the day begins again",
].join("\n");

function coachReq(body: unknown) {
  return new Request("http://localhost/api/lyric-studio/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/lyric-studio/coach — local fallback", () => {
  beforeEach(() => {
    resetApiRateLimitForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects empty draft", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({ action: "coach", draft: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("coach returns tips via local fallback", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "coach",
        draft: "A short line about rain on the window.",
        genre: "Indie",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(String(data.coach).length).toBeGreaterThan(10);
    expect(data.target).toBe("music");
  });

  it("coach music target includes BASIS writing dimensions", async () => {
    const { POST } = await import("./route");
    const longDraft = [
      "The rain falls slow on the window pane.",
      "The rain makes me think of home again.",
      "The rain taps soft like a quiet friend.",
      "The rain keeps falling until the end.",
    ].join("\n");
    const res = await POST(
      coachReq({
        action: "coach",
        draft: longDraft,
        genre: "Indie",
        target: "music",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    const coach = String(data.coach).toLowerCase();
    // Local fallback should detect repeated starts and suggest variety
    expect(coach).toMatch(/vary|repeated|start|sentence|topic|sensory|vocabulary|detail|grammar/);
  });

  it("coach image target avoids lyric advice defaults", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "coach",
        draft: "Rain on glass. A bus stop. Grey sky.",
        genre: "Indie",
        target: "image",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.target).toBe("image");
    expect(String(data.coach).toLowerCase()).toMatch(/visual|image|photo|lighting|subject/);
  });

  it("coach video target mentions motion/camera", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "coach",
        draft: "Someone walks past a window. Leaves move.",
        genre: "Ballad",
        target: "video",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.target).toBe("video");
    expect(String(data.coach).toLowerCase()).toMatch(/camera|motion|video|cinematic|action/);
  });

  it("structure music returns [Verse]/[Chorus] locally", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "structure",
        draft: DRAFT,
        genre: "Ballad",
        target: "music",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.target).toBe("music");
    expect(data.lyrics).toMatch(/\[Verse\]/);
    expect(data.lyrics).toMatch(/\[Chorus\]/);
    expect(data.caption).toMatch(/Ballad/i);
  });

  it("structure image returns visual prompt without lyric tags", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "structure",
        draft: DRAFT,
        genre: "Indie",
        target: "image",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.target).toBe("image");
    expect(data.body || data.lyrics).toBeTruthy();
    expect(String(data.body || data.lyrics)).not.toMatch(/\[Verse\]|\[Chorus\]/i);
    expect(String(data.prompt)).not.toMatch(/\[Verse\]/i);
    expect(String(data.prompt).length).toBeGreaterThan(20);
  });

  it("structure video returns cinematic prompt without lyric tags", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "structure",
        draft: DRAFT,
        genre: "Orchestral",
        target: "video",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.target).toBe("video");
    expect(String(data.body || data.lyrics)).not.toMatch(/\[Verse\]|\[Chorus\]/i);
    expect(String(data.prompt).toLowerCase()).toMatch(
      /push|crane|track|pan|camera|motion|cinematic|shot|fps/,
    );
  });

  it("defaults missing target to music structure", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "structure",
        draft: DRAFT,
        genre: "Hip-hop sketch",
      }),
    );
    const data = await res.json();
    expect(data.target).toBe("music");
    expect(data.lyrics).toMatch(/\[Verse\]/);
  });

  it("extract returns fileText without agent", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "extract",
        fileText: "Rain on the glass.\nI wait for the bus.",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toMatch(/Rain on the glass/);
  });

  it("extract rejects empty payload", async () => {
    const { POST } = await import("./route");
    const res = await POST(coachReq({ action: "extract" }));
    expect(res.status).toBe(400);
  });
});
