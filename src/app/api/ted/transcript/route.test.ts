import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import * as tx from "@/lib/entertain/ted-transcript";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

beforeEach(() => {
  resetApiRateLimitForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/ted/transcript", () => {
  it("rejects bad slug", async () => {
    const res = await GET(
      new Request("http://localhost/api/ted/transcript?slug="),
    );
    expect(res.status).toBe(400);
  });

  it("returns preview only (not full transcript dump)", async () => {
    const long = "word ".repeat(200);
    vi.spyOn(tx, "fetchTedTranscript").mockResolvedValue({
      text: long,
      source: "cache",
    });
    const res = await GET(
      new Request(
        "http://localhost/api/ted/transcript?slug=susan_cain_the_power_of_introverts",
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.hasTranscript).toBe(true);
    expect(data.preview.length).toBeLessThanOrEqual(280);
    expect(data.chars).toBe(long.length);
    expect(data.text).toBeUndefined();
  });
});
