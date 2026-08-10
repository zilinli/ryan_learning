import { describe, it, expect } from "vitest";
import { consumeConsoleSse } from "./console-sse";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(ctrl) {
      if (i >= chunks.length) { ctrl.close(); return; }
      ctrl.enqueue(enc.encode(chunks[i++]));
    },
  });
}

describe("consumeConsoleSse", () => {
  it("parses delta/done and event ids", async () => {
    const ids: number[] = [];
    const full = await consumeConsoleSse(
      streamFrom([
        "id: 1\nevent: delta\ndata: {\"text\":\"Hi\"}\n\n",
        "id: 2\nevent: done\ndata: {\"text\":\"Hi there\"}\n\n",
      ]),
      undefined,
      { onEventId: (id) => ids.push(id) },
    );
    expect(full).toBe("Hi there");
    expect(ids).toEqual([1, 2]);
  });

  it("seeds initialFull when reattaching", async () => {
    const full = await consumeConsoleSse(
      streamFrom(["id: 3\nevent: delta\ndata: {\"text\":\" world\"}\n\n"]),
      undefined,
      {},
      "Hello",
    );
    expect(full).toBe("Hello world");
  });

  it("throws on error event", async () => {
    await expect(
      consumeConsoleSse(
        streamFrom(["event: error\ndata: {\"error\":\"boom\"}\n\n"]),
        undefined,
        {},
      ),
    ).rejects.toThrow("boom");
  });
});
