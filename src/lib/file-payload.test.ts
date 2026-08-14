import { describe, it, expect, vi, afterEach } from "vitest";
import { MAX_VIDEO_BYTES, MAX_VIDEO_MB, MAX_FILE_MB } from "./attachments";
import { fileToAttachment } from "./file-payload";

afterEach(() => {
  vi.unstubAllGlobals();
});

class FakeReader {
  result: string | null = null;
  onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((ev: ProgressEvent<FileReader>) => void) | null = null;
  readAsDataURL() {
    this.result =
      "data:video/mp4;base64," + Buffer.from("dummy-video-bytes").toString("base64");
    queueMicrotask(() => this.onload?.({} as ProgressEvent<FileReader>));
  }
  readAsText() {
    this.result = "ok";
    queueMicrotask(() => this.onload?.({} as ProgressEvent<FileReader>));
  }
}

function videoFile(name: string, size?: number, mime = "video/mp4"): File {
  const f = new File(["x"], name, { type: mime });
  if (size !== undefined) {
    Object.defineProperty(f, "size", { value: size });
  }
  return f;
}

describe("video upload memory safety", () => {
  it("caps short videos at MAX_VIDEO_MB (well below the 256MB file ceiling)", () => {
    expect(MAX_VIDEO_MB).toBeLessThan(MAX_FILE_MB);
    expect(MAX_VIDEO_BYTES).toBe(80 * 1024 * 1024);
  });

  it("rejects videos over the 80MB ceiling with a clear message", async () => {
    await expect(
      fileToAttachment(videoFile("clip.mp4", MAX_VIDEO_BYTES + 1)),
    ).rejects.toThrow(/80MB/);
  });

  it("keeps only raw base64 `data` — never a dataUrl (halves memory)", async () => {
    vi.stubGlobal("FileReader", FakeReader);
    const att = await fileToAttachment(videoFile("clip.mp4", 4 * 1024 * 1024));
    expect(att.kind).toBe("file");
    expect(att.dataUrl).toBeUndefined();
    expect(att.data).toBe(Buffer.from("dummy-video-bytes").toString("base64"));
    expect(att.name).toBe("clip.mp4");
  });

  it("keeps iOS quicktime MIME as-is (valid video)", async () => {
    vi.stubGlobal("FileReader", FakeReader);
    const att = await fileToAttachment(
      videoFile("IMG_0001", 1 * 1024 * 1024, "video/quicktime"),
    );
    expect(att.mimeType).toBe("video/quicktime");
  });

  it("still accepts non-video large files up to MAX_FILE_BYTES", async () => {
    // Stub reader so we never allocate real memory.
    class PdfReader {
      result: string | null = null;
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL() {
        this.result =
          "data:application/pdf;base64," + Buffer.from("%PDF-1.4").toString("base64");
        queueMicrotask(() => this.onload?.({} as ProgressEvent<FileReader>));
      }
      readAsText() {
        this.result = "ok";
        queueMicrotask(() => this.onload?.({} as ProgressEvent<FileReader>));
      }
    }
    vi.stubGlobal("FileReader", PdfReader);
    const big = new File(["x"], "notes.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 100 * 1024 * 1024 });
    const att = await fileToAttachment(big);
    expect(att.kind).toBe("file");
    expect(att.name).toBe("notes.pdf");
  });
});
