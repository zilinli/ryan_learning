import { describe, expect, it } from "vitest";
import { writeMediaBytes, readMedia } from "./media-store";
import { rm } from "node:fs/promises";
import path from "node:path";

describe("writeMediaBytes (song audio)", () => {
  it("round-trips mp3 bytes", async () => {
    const mediaId = `song_test_${Date.now()}`;
    const buf = Buffer.from("ID3fake-audio-bytes");
    const meta = await writeMediaBytes(mediaId, buf, "audio/mpeg", {
      sessionId: "lyric-studio",
      messageId: "generate",
      attachmentId: mediaId,
      name: "demo.mp3",
      kind: "file",
      accountId: "acct_test",
    });
    expect(meta?.bytes).toBe(buf.length);
    const hit = await readMedia(mediaId);
    expect(hit?.mimeType).toBe("audio/mpeg");
    expect(hit?.buf.equals(buf)).toBe(true);

    const dir = path.join(process.cwd(), "data", "media");
    await rm(path.join(dir, `${mediaId}.bin`), { force: true });
    await rm(path.join(dir, `${mediaId}.json`), { force: true });
  });
});
