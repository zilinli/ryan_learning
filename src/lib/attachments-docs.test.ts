import { describe, expect, it } from "vitest";
import {
  FILE_INPUT_ACCEPT,
  isAllowedAttachment,
  isAppleTouchDevice,
  isHtmlAttachment,
  isLargeBinaryAttachment,
  isOfficeAttachment,
  normalizeMime,
  resolveFilePickerAccept,
} from "./attachments";

describe("document upload allowlist", () => {
  it("allows short video extensions and MIME", () => {
    expect(isAllowedAttachment("video/mp4", "clip.mp4")).toBe(true);
    expect(isAllowedAttachment("", "demo.webm")).toBe(true);
    expect(isAllowedAttachment("video/quicktime", "phone.mov")).toBe(true);
  });

  it("allows markdown, html, and office open xml", () => {
    expect(isAllowedAttachment("text/markdown", "notes.md")).toBe(true);
    expect(isAllowedAttachment("", "readme.markdown")).toBe(true);
    expect(isAllowedAttachment("text/html", "page.html")).toBe(true);
    expect(isAllowedAttachment("", "index.htm")).toBe(true);
    expect(isAllowedAttachment("", "hw.docx")).toBe(true);
    expect(isAllowedAttachment("", "slides.pptx")).toBe(true);
    expect(isAllowedAttachment("", "grades.xlsx")).toBe(true);
  });

  it("allows text/* and markdown MIME aliases from iOS", () => {
    expect(isAllowedAttachment("text/plain", "notes.md")).toBe(true);
    expect(isAllowedAttachment("text/x-markdown", "notes.md")).toBe(true);
    expect(isAllowedAttachment("application/markdown", "a.md")).toBe(true);
    expect(isAllowedAttachment("text/csv", "data.csv")).toBe(true);
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
    expect(normalizeMime("text/x-markdown", "a.md")).toBe("text/markdown");
  });

  it("isOfficeAttachment / isHtmlAttachment helpers", () => {
    expect(isOfficeAttachment("", "x.docx")).toBe(true);
    expect(isOfficeAttachment("text/plain", "x.txt")).toBe(false);
    expect(isHtmlAttachment("text/html", "x")).toBe(true);
    expect(isHtmlAttachment("", "x.htm")).toBe(true);
  });

  it("isLargeBinaryAttachment covers video/PDF/Office but not images/text", () => {
    expect(isLargeBinaryAttachment("video/mp4", "clip.mp4")).toBe(true);
    expect(isLargeBinaryAttachment("video/quicktime", "IMG_0001.mov")).toBe(true);
    expect(isLargeBinaryAttachment("application/pdf", "a.pdf")).toBe(true);
    expect(isLargeBinaryAttachment("", "notes.PDF")).toBe(true);
    expect(isLargeBinaryAttachment("", "hw.docx")).toBe(true);
    expect(isLargeBinaryAttachment("", "slides.pptx")).toBe(true);
    expect(isLargeBinaryAttachment("", "grades.xlsx")).toBe(true);
    expect(isLargeBinaryAttachment("image/jpeg", "p.jpg")).toBe(false);
    expect(isLargeBinaryAttachment("image/png", "s.png")).toBe(false);
    expect(isLargeBinaryAttachment("text/plain", "a.txt")).toBe(false);
    expect(isLargeBinaryAttachment("text/markdown", "a.md")).toBe(false);
  });

  it("FILE_INPUT_ACCEPT lists office and html", () => {
    expect(FILE_INPUT_ACCEPT).toContain(".docx");
    expect(FILE_INPUT_ACCEPT).toContain(".pptx");
    expect(FILE_INPUT_ACCEPT).toContain(".xlsx");
    expect(FILE_INPUT_ACCEPT).toContain(".html");
    expect(FILE_INPUT_ACCEPT).toContain(".md");
  });

  it("uses all-files accept on Apple touch devices so iOS can pick .md", () => {
    expect(
      isAppleTouchDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      ),
    ).toBe(true);
    expect(resolveFilePickerAccept(FILE_INPUT_ACCEPT, true)).toBe("*/*");
    expect(resolveFilePickerAccept(FILE_INPUT_ACCEPT, false)).toBe(
      FILE_INPUT_ACCEPT,
    );
    expect(
      isAppleTouchDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", {
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      isAppleTouchDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", {
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });

  it("defer-mount contract: Apple gets all-files accept, desktop keeps filter", () => {
    // Composers must mount <input> only after resolveFilePickerAccept — never
    // paint desktop accept then change it (WebKit keeps the first filter).
    const apple = resolveFilePickerAccept(FILE_INPUT_ACCEPT, true);
    const desktop = resolveFilePickerAccept(FILE_INPUT_ACCEPT, false);
    expect(apple).toBe("*/*");
    expect(desktop).toBeTruthy();
    expect(desktop).toContain(".md");
  });
});
