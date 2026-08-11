import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTedTranscript } from "./ted-transcript";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const SLUG = "test_transcript_unit_slug";

function cacheFile(): string {
  const h = createHash("sha256").update(SLUG).digest("hex").slice(0, 16);
  return path.join(
    process.cwd(),
    "data",
    "ted-cache",
    `${SLUG.slice(0, 40)}_${h}.txt`,
  );
}

beforeEach(async () => {
  try {
    await fs.unlink(cacheFile());
  } catch {
    /* ok */
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchTedTranscript", () => {
  it("returns empty for invalid slug", async () => {
    const r = await fetchTedTranscript("!!!");
    expect(r.source).toBe("empty");
    expect(r.text).toBe("");
  });

  it("uses subtitle JSON when available and caches", async () => {
    const payload = {
      cues: [
        { content: "First sentence about creativity in schools." },
        { content: "Second sentence with more evidence for listening." },
        { content: "Third beat closes the argument carefully." },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const first = await fetchTedTranscript(SLUG);
    expect(first.source).toBe("subtitles");
    expect(first.text).toMatch(/creativity/);

    // Second call should hit cache (no extra network needed for logic)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network should not be used")),
    );
    const second = await fetchTedTranscript(SLUG);
    expect(second.source).toBe("cache");
    expect(second.text).toContain("creativity");

    try {
      await fs.unlink(cacheFile());
    } catch {
      /* ok */
    }
  });
});
