import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bailianPollAttempts,
  extractFiletransText,
  extractTaskResultUrl,
  getPodcastTranscriptJob,
  podcastEngines,
  requestPodcastTranscript,
  resolveAudioUrl,
  setPodcastCacheDirsForTests,
  PODCAST_TRANSCRIPT_MAX_CHARS,
} from "./podcast-transcript";
import type { PodcastShow } from "./podcast-catalog";
import type { PodcastEpisode } from "./podcast-rss";

const SHOW: PodcastShow = {
  id: "unit-show",
  title: "Unit Show",
  host: "Unit Host",
  feedUrl: "https://example.com/feed.xml",
  topics: ["ideas"],
  blurb: "Unit blurb",
};

const EPISODE: PodcastEpisode = {
  guid: "ep-unit-1",
  title: "Unit Episode",
  description: "About ideas.",
  audioUrl: "https://cdn.example.com/ep1.mp3",
  durationSec: 600,
  pubDate: "Tue, 01 Jan 2026 10:00:00 GMT",
  categories: ["ideas"],
};

describe("extractFiletransText", () => {
  it("reads transcripts[].text", () => {
    const text = extractFiletransText({
      transcripts: [{ text: "Hello world. This is a test." }],
    });
    expect(text).toBe("Hello world. This is a test.");
  });

  it("joins sentences when text is absent", () => {
    const text = extractFiletransText({
      transcripts: [
        { sentences: [{ text: "First." }, { text: "Second." }] },
      ],
    });
    expect(text).toBe("First. Second.");
  });

  it("handles the wrapper shape with output.transcripts", () => {
    const text = extractFiletransText({
      output: { transcripts: [{ text: "Wrapped." }] },
    });
    expect(text).toBe("Wrapped.");
  });

  it("returns empty for junk", () => {
    expect(extractFiletransText(null)).toBe("");
    expect(extractFiletransText("x")).toBe("");
    expect(extractFiletransText({})).toBe("");
  });
});

describe("bailianPollAttempts", () => {
  it("scales the poll budget with audio length", () => {
    expect(bailianPollAttempts(0)).toBeGreaterThanOrEqual(72);
    const short = bailianPollAttempts(5 * 60);
    const long = bailianPollAttempts(50 * 60);
    expect(long).toBeGreaterThan(short);
  });
});

describe("extractTaskResultUrl", () => {
  const url = "https://oss.example.com/result.json";

  it("reads transcription_url on the first result", () => {
    expect(
      extractTaskResultUrl({
        output: {
          task_status: "SUCCEEDED",
          results: [{ transcription_url: url }],
        },
      }),
    ).toBe(url);
  });

  it("reads the nested output.transcription_url shape", () => {
    expect(
      extractTaskResultUrl({
        output: {
          results: [{ output: { transcription_url: url } }],
        },
      }),
    ).toBe(url);
  });

  it("falls back to transcripts[].url", () => {
    expect(
      extractTaskResultUrl({
        output: { results: [{ transcripts: [{ url }] }] },
      }),
    ).toBe(url);
  });

  it("returns empty when nothing matches", () => {
    expect(extractTaskResultUrl(null)).toBe("");
    expect(extractTaskResultUrl({ output: { results: [] } })).toBe("");
    expect(extractTaskResultUrl({ output: { results: [{}] } })).toBe("");
  });
});

describe("resolveAudioUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the final URL after a redirect chain", async () => {
    const finalUrl = "https://cdn.example.com/file.mp3";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ url: finalUrl }) as Response),
    );
    await expect(resolveAudioUrl("https://r.example.com/a")).resolves.toBe(finalUrl);
  });

  it("keeps the original URL when resolution fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    await expect(resolveAudioUrl("https://r.example.com/a")).resolves.toBe(
      "https://r.example.com/a",
    );
  });
});

describe("podcast transcript jobs", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "podcast-trans-"));
    setPodcastCacheDirsForTests(dir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("returns a done job instantly when transcript is cached", async () => {
    vi.spyOn(podcastEngines, "bailian").mockResolvedValue("cached text");

    const first = await requestPodcastTranscript(SHOW, EPISODE);
    await waitForDone(first.id);

    const second = await requestPodcastTranscript(SHOW, EPISODE);
    expect(second.status).toBe("done");
    expect(second.engine).toBe("cache");
    expect(second.transcript).toContain("cached text");
  });

  it("runs the bailian engine and persists the job + cache", async () => {
    const spy = vi
      .spyOn(podcastEngines, "bailian")
      .mockResolvedValue("Transcribed by bailian with lots of content. ".repeat(5));
    const localSpy = vi
      .spyOn(podcastEngines, "local")
      .mockRejectedValue(new Error("should not be used"));

    const job = await requestPodcastTranscript(SHOW, EPISODE);
    // The worker may flip queued → running before the promise resolves.
    expect(["queued", "running"]).toContain(job.status);

    const done = await waitForDone(job.id);
    expect(done.status).toBe("done");
    expect(done.engine).toBe("bailian");
    expect(done.progress).toBe(1);
    expect(done.transcript).toContain("bailian");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(localSpy).not.toHaveBeenCalled();
  });

  it("falls back to the local engine when bailian fails", async () => {
    vi.spyOn(podcastEngines, "bailian").mockRejectedValue(
      new Error("DashScope down"),
    );
    vi.spyOn(podcastEngines, "local").mockResolvedValue(
      "Whisper fallback output.",
    );

    const job = await requestPodcastTranscript(SHOW, EPISODE);
    const done = await waitForDone(job.id);
    expect(done.status).toBe("done");
    expect(done.engine).toBe("local");
    expect(done.transcript).toContain("Whisper fallback");
  });

  it("marks the job error when both engines fail", async () => {
    vi.spyOn(podcastEngines, "bailian").mockRejectedValue(
      new Error("bailian down"),
    );
    vi.spyOn(podcastEngines, "local").mockRejectedValue(
      new Error("local down"),
    );

    const job = await requestPodcastTranscript(SHOW, EPISODE);
    const done = await waitForDone(job.id);
    expect(done.status).toBe("error");
    expect(done.error).toBeTruthy();
  });

  it("caps stored transcripts at the max chars", async () => {
    const big = "A".repeat(PODCAST_TRANSCRIPT_MAX_CHARS + 500);
    vi.spyOn(podcastEngines, "bailian").mockResolvedValue(big);

    const job = await requestPodcastTranscript(SHOW, EPISODE);
    const done = await waitForDone(job.id);
    expect((done.transcript || "").length).toBeLessThanOrEqual(
      PODCAST_TRANSCRIPT_MAX_CHARS,
    );
  });

  it("getPodcastTranscriptJob returns null for unknown ids", async () => {
    expect(await getPodcastTranscriptJob("nope")).toBeNull();
  });
});

async function waitForDone(jobId: string): Promise<NonNullable<Awaited<ReturnType<typeof getPodcastTranscriptJob>>>> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const job = await getPodcastTranscriptJob(jobId);
    if (job && (job.status === "done" || job.status === "error")) return job;
    await new Promise((r) => setTimeout(r, 25));
  }
  const final = await getPodcastTranscriptJob(jobId);
  throw new Error(`job did not finish (${final?.status})`);
}
