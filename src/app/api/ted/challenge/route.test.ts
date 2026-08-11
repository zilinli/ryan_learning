import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as tx from "@/lib/entertain/ted-transcript";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

beforeEach(() => {
  resetApiRateLimitForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/ted/challenge", () => {
  it("rejects invalid slug", async () => {
    const res = await POST(
      new Request("http://localhost/api/ted/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "https://evil.com/x" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns fallback challenge when transcript is thin (no Agent)", async () => {
    vi.spyOn(tx, "fetchTedTranscript").mockResolvedValue({
      text: "Short.",
      source: "empty",
    });

    const res = await POST(
      new Request("http://localhost/api/ted/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "susan_cain_the_power_of_introverts",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.challenge.items.length).toBeGreaterThanOrEqual(4);
    expect(data.challenge.talkSlug).toContain("susan_cain");
    const kinds = new Set(
      data.challenge.items.map((i: { kind: string }) => i.kind),
    );
    expect(kinds.has("literal")).toBe(true);
    expect(kinds.has("critique")).toBe(true);
  });

  it("still returns items for unknown slug via stub talk", async () => {
    vi.spyOn(tx, "fetchTedTranscript").mockResolvedValue({
      text: "",
      source: "empty",
    });
    const res = await POST(
      new Request("http://localhost/api/ted/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "some_custom_talk_slug_here" }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.challenge.items.length).toBeGreaterThanOrEqual(3);
  });
});
