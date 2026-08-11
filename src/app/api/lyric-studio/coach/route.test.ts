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
      new Request("http://localhost/api/lyric-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "coach", draft: "" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("coach returns tips via local fallback", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/lyric-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "coach",
          draft: "A short line about rain on the window.",
          genre: "Indie",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(String(data.coach).length).toBeGreaterThan(10);
  });

  it("structure returns [Verse]/[Chorus] locally", async () => {
    const { POST } = await import("./route");
    const draft = [
      "Morning light on the desk",
      "I fold the page I never finished",
      "The kettle clicks once",
      "And the day begins again",
    ].join("\n");
    const res = await POST(
      new Request("http://localhost/api/lyric-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "structure",
          draft,
          genre: "Ballad",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.lyrics).toMatch(/\[Verse\]/);
    expect(data.lyrics).toMatch(/\[Chorus\]/);
    expect(data.caption).toMatch(/Ballad/i);
  });

  it("extract returns fileText without agent", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/lyric-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract",
          fileText: "Rain on the glass.\nI wait for the bus.",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toMatch(/Rain on the glass/);
  });
});
