import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampVolcLyrics,
  isVolcMusicConfigured,
  volcBillingOrder,
  volcGenerateSongWithBillingFallback,
  volcSubmitSong,
} from "./volc-gensong-client";

const OLD = { ...process.env };

beforeEach(() => {
  process.env = { ...OLD };
  delete process.env.VOLC_ACCESS_KEY_ID;
  delete process.env.VOLC_SECRET_ACCESS_KEY;
  delete process.env.VOLC_MUSIC_BILLING_ORDER;
});

afterEach(() => {
  process.env = { ...OLD };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("volc-gensong-client", () => {
  it("detects config and billing order", () => {
    expect(isVolcMusicConfigured()).toBe(false);
    process.env.VOLC_ACCESS_KEY_ID = "ak";
    process.env.VOLC_SECRET_ACCESS_KEY = "sk";
    expect(isVolcMusicConfigured()).toBe(true);
    expect(volcBillingOrder()).toEqual(["prepaid", "postpaid"]);
    process.env.VOLC_MUSIC_BILLING_ORDER = "postpaid,prepaid";
    expect(volcBillingOrder()).toEqual(["postpaid", "prepaid"]);
  });

  it("clamps CN lyrics to 700", () => {
    const cn = "歌词".repeat(400);
    expect(clampVolcLyrics(cn).length).toBeLessThanOrEqual(700);
  });

  it("submits GenSongForTime (postpaid) and returns TaskID", async () => {
    process.env.VOLC_ACCESS_KEY_ID = "AKLTTEST";
    process.env.VOLC_SECRET_ACCESS_KEY = "secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Code: 0,
          Message: "success",
          Result: { TaskID: "task-1", PredictedWaitTime: 10 },
          ResponseMetadata: {
            RequestId: "req-1",
            Action: "GenSongForTime",
            Error: null,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await volcSubmitSong(
      { lyrics: "[Verse]\nhello world enough chars" },
      "postpaid",
    );
    expect(r.status).toBe("pending");
    expect(r.taskId).toBe("task-1");
    expect(r.provider).toBe("volc-postpaid");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("Action=GenSongForTime");
    expect(url).toContain("Version=2024-08-12");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toContain("HMAC-SHA256");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.Lyrics).toBeTruthy();
    expect(body.VodFormat).toBe("mp3");
  });

  it("falls through prepaid fail → postpaid success", async () => {
    process.env.VOLC_ACCESS_KEY_ID = "AKLTTEST";
    process.env.VOLC_SECRET_ACCESS_KEY = "secret";
    process.env.VOLC_MUSIC_BILLING_ORDER = "prepaid,postpaid";

    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        call += 1;
        const u = String(url);
        if (u.includes("Action=GenSongV4")) {
          return new Response(
            JSON.stringify({
              ResponseMetadata: {
                Error: { Code: "QuotaExceeded", Message: "prepaid exhausted" },
              },
            }),
            { status: 200 },
          );
        }
        if (u.includes("Action=GenSongForTime")) {
          return new Response(
            JSON.stringify({
              Result: { TaskID: "task-post" },
              ResponseMetadata: { RequestId: "r2", Error: null },
            }),
            { status: 200 },
          );
        }
        // QuerySong
        return new Response(
          JSON.stringify({
            Result: {
              TaskID: "task-post",
              Status: 2,
              Progress: 100,
              SongDetail: {
                AudioUrl: "https://v1-default.douyinvod.com/a.mp3",
                Duration: 40,
                Lyrics: "[verse]\nhi",
              },
            },
            ResponseMetadata: { Error: null },
          }),
          { status: 200 },
        );
      }),
    );

    const r = await volcGenerateSongWithBillingFallback(
      { lyrics: "[Verse]\nenough lyric text here for volc" },
      { maxWaitMs: 8_000, pollMs: 10 },
    );
    expect(r.status).toBe("done");
    expect(r.provider).toBe("volc-postpaid");
    expect(r.audioUrl).toContain("douyinvod.com");
    expect(r.attempts?.some((a) => a.includes("fail:prepaid"))).toBe(true);
    expect(r.attempts?.some((a) => a.includes("ok:postpaid"))).toBe(true);
    expect(call).toBeGreaterThanOrEqual(3);
  });
});
