import { describe, expect, it } from "vitest";
import {
  guessKind,
  isAllowedAttachment,
  MAX_ATTACHMENTS,
  normalizeIncomingAttachments,
  normalizeMime,
  stripDataUrlPrefix,
} from "./attachments";

describe("guessKind / isAllowedAttachment / normalizeMime", () => {
  it("classifies images vs files", () => {
    expect(guessKind("image/png", "a.png")).toBe("image");
    expect(guessKind("application/pdf", "a.pdf")).toBe("file");
    expect(guessKind("", "photo.HEIC")).toBe("image");
  });

  it("allows common homework formats and camera blobs", () => {
    expect(isAllowedAttachment("image/jpeg", "x.jpg")).toBe(true);
    expect(isAllowedAttachment("application/pdf", "hw.pdf")).toBe(true);
    expect(isAllowedAttachment("text/plain", "notes.txt")).toBe(true);
    expect(isAllowedAttachment("", "image.jpg")).toBe(true);
    expect(isAllowedAttachment("application/octet-stream", "blob")).toBe(true);
    expect(isAllowedAttachment("application/zip", "x.zip")).toBe(false);
  });

  it("fills mime from extension when missing", () => {
    expect(normalizeMime("", "a.png")).toBe("image/png");
    expect(normalizeMime("", "a.pdf")).toBe("application/pdf");
    expect(normalizeMime("image/jpg", "a.jpg")).toBe("image/jpeg");
    expect(normalizeMime("application/octet-stream", "shot.webp")).toBe(
      "image/webp",
    );
  });

  it("strips data-url prefix", () => {
    expect(stripDataUrlPrefix("data:image/png;base64,AAA")).toBe("AAA");
    expect(stripDataUrlPrefix("plain")).toBe("plain");
  });
});

describe("normalizeIncomingAttachments", () => {
  it("prefers attachments[] and caps count", () => {
    const many = Array.from({ length: MAX_ATTACHMENTS + 3 }, (_, i) => ({
      name: `f${i}.png`,
      mimeType: "image/png",
      kind: "image" as const,
      data: "abcd",
    }));
    const out = normalizeIncomingAttachments({ attachments: many });
    expect(out).toHaveLength(MAX_ATTACHMENTS);
    expect(out[0]?.name).toBe("f0.png");
  });

  it("falls back to legacy image field", () => {
    const out = normalizeIncomingAttachments({
      image: {
        data: "data:image/jpeg;base64,QUJD",
        mimeType: "image/jpeg",
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("image");
    expect(out[0]?.data).toBe("QUJD");
    expect(out[0]?.name).toBe("photo.jpg");
  });

  it("returns empty when nothing attached", () => {
    expect(normalizeIncomingAttachments({})).toEqual([]);
  });
});
