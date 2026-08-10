import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFileSummaries,
  extractOfficeText,
  extractPdfText,
  htmlToPlainText,
} from "./extract-files";

const fixtures = path.join(__dirname, "__fixtures__");

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

  it("strips HTML tags from textContent", async () => {
    const out = await buildFileSummaries([
      {
        name: "page.html",
        mimeType: "text/html",
        kind: "file",
        textContent:
          "<html><script>evil()</script><p>Hello <b>Spark</b></p></html>",
      },
    ]);
    expect(out[0]).toContain("Hello Spark");
    expect(out[0]).not.toContain("<script");
    expect(out[0]).not.toContain("evil");
  });

  it("extracts text from fixture docx/pptx/xlsx", async () => {
    const docx = readFileSync(path.join(fixtures, "sample.docx"));
    const pptx = readFileSync(path.join(fixtures, "sample.pptx"));
    const xlsx = readFileSync(path.join(fixtures, "sample.xlsx"));
    const out = await buildFileSummaries([
      {
        name: "sample.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        kind: "file",
        data: docx.toString("base64"),
      },
      {
        name: "sample.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        kind: "file",
        data: pptx.toString("base64"),
      },
      {
        name: "sample.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        kind: "file",
        data: xlsx.toString("base64"),
      },
    ]);
    expect(out.join("\n")).toContain("SparkDocxMarker42");
    expect(out.join("\n")).toContain("SparkPptxMarker99");
    expect(out.join("\n")).toContain("SparkXlsxMarker77");
  });

  it("reports when office file has no extractable text", async () => {
    const out = await buildFileSummaries([
      {
        name: "broken.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        kind: "file",
        data: Buffer.from("not-a-docx").toString("base64"),
      },
    ]);
    expect(out[0]).toMatch(/could not be extracted/i);
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

describe("htmlToPlainText", () => {
  it("removes tags and entities", () => {
    expect(htmlToPlainText("<p>A&nbsp;B</p>")).toBe("A B");
  });
});

describe("extractOfficeText", () => {
  it("reads fixture docx", async () => {
    const b64 = readFileSync(path.join(fixtures, "sample.docx")).toString(
      "base64",
    );
    const text = await extractOfficeText(b64, "sample.docx");
    expect(text).toContain("SparkDocxMarker42");
  });
});

describe("extractPdfText", () => {
  it("returns empty string for invalid pdf payload", async () => {
    const text = await extractPdfText("not-valid-base64-pdf!!!");
    expect(text).toBe("");
  });
});
