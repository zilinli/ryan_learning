import { describe, expect, it } from "vitest";
import {
  FILE_INPUT_ACCEPT,
  isAllowedAttachment,
  isHtmlAttachment,
  isOfficeAttachment,
  normalizeMime,
} from "./attachments";

describe("document upload allowlist", () => {
  it("allows markdown, html, and office open xml", () => {
    expect(isAllowedAttachment("text/markdown", "notes.md")).toBe(true);
    expect(isAllowedAttachment("", "readme.markdown")).toBe(true);
    expect(isAllowedAttachment("text/html", "page.html")).toBe(true);
    expect(isAllowedAttachment("", "index.htm")).toBe(true);
    expect(isAllowedAttachment("", "hw.docx")).toBe(true);
    expect(isAllowedAttachment("", "slides.pptx")).toBe(true);
    expect(isAllowedAttachment("", "grades.xlsx")).toBe(true);
  });

  it("allows console code extensions", () => {
    expect(isAllowedAttachment("", "app.ts")).toBe(true);
    expect(isAllowedAttachment("", "script.py")).toBe(true);
  });

  it("rejects legacy office binary and random zip/exe", () => {
    expect(isAllowedAttachment("", "old.doc")).toBe(false);
    expect(isAllowedAttachment("", "old.ppt")).toBe(false);
    expect(isAllowedAttachment("application/zip", "a.zip")).toBe(false);
    expect(isAllowedAttachment("application/x-msdownload", "a.exe")).toBe(
      false,
    );
  });

  it("normalizeMime maps office and html extensions", () => {
    expect(normalizeMime("", "a.docx")).toContain("wordprocessingml");
    expect(normalizeMime("", "a.pptx")).toContain("presentationml");
    expect(normalizeMime("", "a.xlsx")).toContain("spreadsheetml");
    expect(normalizeMime("", "a.html")).toBe("text/html");
    expect(normalizeMime("", "a.md")).toBe("text/markdown");
  });

  it("isOfficeAttachment / isHtmlAttachment helpers", () => {
    expect(isOfficeAttachment("", "x.docx")).toBe(true);
    expect(isOfficeAttachment("text/plain", "x.txt")).toBe(false);
    expect(isHtmlAttachment("text/html", "x")).toBe(true);
    expect(isHtmlAttachment("", "x.htm")).toBe(true);
  });

  it("FILE_INPUT_ACCEPT lists office and html", () => {
    expect(FILE_INPUT_ACCEPT).toContain(".docx");
    expect(FILE_INPUT_ACCEPT).toContain(".pptx");
    expect(FILE_INPUT_ACCEPT).toContain(".xlsx");
    expect(FILE_INPUT_ACCEPT).toContain(".html");
  });
});
