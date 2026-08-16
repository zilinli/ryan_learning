import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";
import type { SDKAgent } from "@cursor/sdk";
import { Agent } from "@cursor/sdk";

vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: vi.fn(async () => {
      throw new Error("Agent disabled in unit tests");
    }),
  },
  CursorAgentError: class CursorAgentError extends Error {},
}));

/** Fake SDKAgent that streams one assistant text block. */
function fakeAgent(text: string): SDKAgent {
  return {
    send: async () => ({
      stream: async function* () {
        yield {
          type: "assistant",
          message: {
            content: [{ type: "text", text }],
          },
        };
      },
    }),
    close: async () => {},
  } as unknown as SDKAgent;
}

const DRAFT = [
  "Morning light on the desk",
  "I fold the page I never finished",
  "The kettle clicks once",
  "And the day begins again",
].join("\n");

function coachReq(body: unknown) {
  return new Request("http://localhost/api/writing-studio/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/writing-studio/coach — local fallback", () => {
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

  it("coach music target returns BASIS report with 4 dimensions", async () => {
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
    expect(data.report).toBeTruthy();
    expect(data.report.dimensions).toHaveLength(4);
    expect(data.report.dimensions.map((d: { id: string }) => d.id)).toEqual([
      "topic",
      "detail",
      "vocab",
      "grammar",
    ]);
    expect(data.report.overall).toBeGreaterThanOrEqual(1);
    expect(String(data.coach)).toMatch(/Craft tip:/i);
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
    expect(data.suggestedStyle).toBeTruthy();
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

describe("POST /api/writing-studio/coach — mentor edit protocol", () => {
  beforeEach(() => {
    resetApiRateLimitForTests();
    process.env.CURSOR_API_KEY = "test-key-for-mentor";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes through a structured edit when the agent returns JSON with a known spanId", async () => {
    vi.mocked(Agent.create).mockResolvedValue(
      fakeAgent(
        JSON.stringify({
          reply: "I can see it now — dashed down the road.",
          edit: { spanId: "fix_vocab_1_3", replacement: "dashed down the road" },
        }),
      ),
    );
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "mentor",
        draft: "I ran things and stuff happened.",
        genre: "Indie",
        target: "music",
        studentReply: "dashed down the road",
        history: [{ role: "coach", text: "What word only you would use?" }],
        openIssues: [
          { id: "fix_vocab_1_3", span: "things", dimension: "vocab" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reply).toMatch(/dashed down the road/);
    expect(data.edit).toEqual({
      spanId: "fix_vocab_1_3",
      replacement: "dashed down the road",
    });
  });

  it("ignores edit whose spanId is not in the open issues list", async () => {
    vi.mocked(Agent.create).mockResolvedValue(
      fakeAgent(
        JSON.stringify({
          reply: "Let's tighten that line.",
          edit: { spanId: "fix_vocab_9_9", replacement: "ghost edit" },
        }),
      ),
    );
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "mentor",
        draft: "I ran things and stuff happened.",
        genre: "Indie",
        target: "music",
        studentReply: "dashed down the road",
        history: [],
        openIssues: [
          { id: "fix_vocab_1_3", span: "things", dimension: "vocab" },
        ],
      }),
    );
    const data = await res.json();
    expect(data.reply).toMatch(/tighten that line/);
    expect(data.edit).toBeNull();
  });

  it("keeps a plain-text reply when the agent returns no JSON at all", async () => {
    vi.mocked(Agent.create).mockResolvedValue(
      fakeAgent(
        "That's a sharper word. Can you use it in the next line?",
      ),
    );
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "mentor",
        draft: "I ran things and stuff happened.",
        genre: "Indie",
        target: "music",
        studentReply: "dashed down the road",
        history: [],
      }),
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reply).toMatch(/sharper word/);
    expect(data.edit).toBeNull();
  });

  it("falls back to the local mentor when the agent fails", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      coachReq({
        action: "mentor",
        draft: "Things keep happening and stuff feels weird.",
        genre: "Indie",
        target: "music",
        studentReply: "the cracked phone on the bus",
        history: [],
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reply).toMatch(/\?/);
    expect(data.edit).toBeNull();
  });
});
