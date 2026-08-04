import { describe, expect, it } from "vitest";
import { buildContentDisposition } from "../app/api/media/[mediaId]/route";

describe("buildContentDisposition", () => {
  it("keeps ASCII filenames as a simple header", () => {
    const h = buildContentDisposition("hw.jpg", "image/jpeg", {
      download: false,
      inlineImage: true,
    });
    expect(h).toBe('inline; filename="hw.jpg"');
  });

  it("uses RFC 5987 for Chinese screenshot names (no non-ASCII in header bytes)", () => {
    const name = "屏幕截图 2026-08-04 115612.png";
    const h = buildContentDisposition(name, "image/png", {
      download: false,
      inlineImage: true,
    });
    expect(h.startsWith('inline; filename="')).toBe(true);
    expect(h).toContain("filename*=UTF-8''");
    expect(h).toContain(encodeURIComponent(name));
    // Response headers are ByteStrings — every char must be <= 255
    for (let i = 0; i < h.length; i += 1) {
      expect(h.charCodeAt(i)).toBeLessThanOrEqual(255);
    }
    // Must not throw when used as a real Response header
    expect(
      () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Disposition": h },
        }),
    ).not.toThrow();
  });

  it("forces attachment for downloads and non-images", () => {
    expect(
      buildContentDisposition("a.pdf", "application/pdf", {
        download: false,
        inlineImage: false,
      }),
    ).toMatch(/^attachment;/);
    expect(
      buildContentDisposition("a.png", "image/png", {
        download: true,
        inlineImage: true,
      }),
    ).toMatch(/^attachment;/);
  });

  it("Response accepts Chinese download headers and bare inline image responses", () => {
    const name = "屏幕截图.png";
    const download = buildContentDisposition(name, "image/png", {
      download: true,
      inlineImage: true,
    });
    expect(
      () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Disposition": download },
        }),
    ).not.toThrow();
    // Inline history <img> should omit Content-Disposition entirely
    expect(
      () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=86400",
          },
        }),
    ).not.toThrow();
  });
});
