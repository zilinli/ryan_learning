/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gtxTranslatePassage,
  isGtxLangMatch,
  looksMostlyEnglish,
} from "./dict-translate";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("looksMostlyEnglish (heuristic only — not used to skip MT)", () => {
  it("accepts plain English tutoring text", () => {
    expect(looksMostlyEnglish("Let's draw a right triangle together.")).toBe(
      true,
    );
  });

  it("rejects Chinese", () => {
    expect(looksMostlyEnglish("我们来画一个直角三角形吧")).toBe(false);
  });

  it("rejects Malay / Spanish / French Latin script", () => {
    expect(
      looksMostlyEnglish(
        "Hai Ching! Apa yang nak kita buat hari ni? Matematik atau cerita?",
      ),
    ).toBe(false);
    expect(
      looksMostlyEnglish("Hola — ¿qué matemáticas hacemos hoy?"),
    ).toBe(false);
    expect(
      looksMostlyEnglish("Bonjour — qu'est-ce qu'on fait aujourd'hui?"),
    ).toBe(false);
  });
});

describe("isGtxLangMatch", () => {
  it("matches English detections", () => {
    expect(isGtxLangMatch("en", "en", "en")).toBe(true);
    expect(isGtxLangMatch("en-us", "en", "en")).toBe(true);
    expect(isGtxLangMatch("ms", "en", "en")).toBe(false);
    expect(isGtxLangMatch("es", "en", "en")).toBe(false);
  });
});

describe("gtxTranslatePassage", () => {
  it("always calls gtx for Latin-script Malay (never Already English skip)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          [["Hi Ching! What shall we do today?", "Hai Ching!...", null, null, 10]],
          null,
          "ms",
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const malay =
      "Hai Ching! Bunyi macam nak buat ucapan besar — Apa yang nak kita buat hari ni?";
    const out = await gtxTranslatePassage(malay, "en");
    expect(mockFetch).toHaveBeenCalled();
    expect(out?.alreadyTarget).toBe(false);
    expect(out?.detectedSource).toBe("ms");
    expect(out?.translation).toMatch(/What shall we do|today/i);
    expect(out?.translation).not.toMatch(/macam nak buat/i);
  });

  it("marks alreadyTarget only when gtx detects English", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          [["Please solve this fraction problem.", "Please solve this fraction problem.", null, null, 10]],
          null,
          "en",
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const out = await gtxTranslatePassage(
      "Please solve this fraction problem.",
      "en",
    );
    expect(out?.alreadyTarget).toBe(true);
    expect(out?.detectedSource).toBe("en");
  });

  it("translates Spanish via gtx", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          [["Hello — what math shall we do today?", "Hola...", null, null, 10]],
          null,
          "es",
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const out = await gtxTranslatePassage(
      "Hola — ¿qué matemáticas hacemos hoy?",
      "en",
    );
    expect(out?.alreadyTarget).toBe(false);
    expect(out?.detectedSource).toBe("es");
    expect(out?.translation).toMatch(/math|today/i);
  });
});
