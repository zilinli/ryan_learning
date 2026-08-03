import { describe, expect, it } from "vitest";
import { buildFileSummaries, extractPdfText } from "./extract-files";

describe("buildFileSummaries", () => {
  it("ignores image attachments", async () => {
    const out = await buildFileSummaries([
      {
        name: "p.jpg",
        mimeType: "image/jpeg",
        kind: "image",
        data: "AAAA",
      },
    ]);
    expect(out).toEqual([]);
  });

  it("uses provided textContent for text files", async () => {
    const out = await buildFileSummaries([
      {
        name: "notes.txt",
        mimeType: "text/plain",
        kind: "file",
        textContent: "line one\nline two",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("File 1 (notes.txt)");
    expect(out[0]).toContain("line one");
  });

  it("reports when file has no extractable text", async () => {
    const out = await buildFileSummaries([
      {
        name: "empty.bin",
        mimeType: "application/octet-stream",
        kind: "file",
      },
    ]);
    expect(out[0]).toMatch(/No extractable text/);
  });
});

describe("extractPdfText", () => {
  it("returns empty string for invalid pdf payload", async () => {
    const text = await extractPdfText("not-valid-base64-pdf!!!");
    expect(text).toBe("");
  });
});
