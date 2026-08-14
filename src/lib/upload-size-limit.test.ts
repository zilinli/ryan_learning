import { describe, it, expect, vi } from "vitest";
import { MAX_FILE_BYTES, MAX_FILE_MB } from "./attachments";
import { fileToAttachment } from "./file-payload";

describe("upload size limit 256MB", () => {
  it("UP-1: MAX_FILE_BYTES is 256 MiB", () => {
    expect(MAX_FILE_BYTES).toBe(256 * 1024 * 1024);
    expect(MAX_FILE_MB).toBe(256);
  });

  it("UP-2: rejects files over the limit with 256MB message", async () => {
    const huge = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(huge, "size", { value: MAX_FILE_BYTES + 1 });
    await expect(fileToAttachment(huge)).rejects.toThrow(/256MB/);
  });

  it("UP-3: does not reject for size when at the limit", async () => {
    // Stub FileReader so we never allocate a 256MB buffer in tests
    class FakeReader {
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
    vi.stubGlobal("FileReader", FakeReader);

    const atLimit = new File(["x"], "edge.pdf", { type: "application/pdf" });
    Object.defineProperty(atLimit, "size", { value: MAX_FILE_BYTES });
    const att = await fileToAttachment(atLimit);
    expect(att.name).toBe("edge.pdf");
    expect(att.kind).toBe("file");

    vi.unstubAllGlobals();
  });
});
