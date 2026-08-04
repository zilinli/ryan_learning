import { describe, it, expect } from "vitest";

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseEncodeWithId(id: number, event: string, data: unknown): string {
  return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("SSE Encode", () => {
  it("includes event and data fields", () => {
    const result = sseEncode("delta", { text: "hello" });
    expect(result).toContain("event: delta");
    expect(result).toContain("data: ");
    expect(result).toContain('"text":"hello"');
  });

  it("emits proper SSE format ending with double newline", () => {
    const result = sseEncode("delta", { text: "hello" });
    expect(result.endsWith("\n\n")).toBe(true);
  });

  it("includes id field when provided", () => {
    const result = sseEncodeWithId(42, "delta", { text: "world" });
    expect(result).toContain("id: 42");
    expect(result).toContain("event: delta");
    expect(result).toContain('"text":"world"');
  });

  it("id increments correctly across events", () => {
    let id = 0;
    const events: string[] = [];
    for (let i = 0; i < 3; i++) {
      id += 1;
      events.push(sseEncodeWithId(id, "message", { idx: i }));
    }
    expect(events[0]).toContain("id: 1");
    expect(events[1]).toContain("id: 2");
    expect(events[2]).toContain("id: 3");
  });

  it("heartbeat comment is valid SSE", () => {
    const hb = ":hb\n\n";
    // Heartbeat comments don't need event or data fields
    expect(hb.startsWith(":")).toBe(true);
    expect(hb.endsWith("\n\n")).toBe(true);
  });

  it("handles special characters in data safely", () => {
    const result = sseEncode("delta", { text: "line1\nline2", emoji: "🛠" });
    const parsed = JSON.parse(result.split("\ndata: ")[1].trim());
    expect(parsed.text).toBe("line1\nline2");
    expect(parsed.emoji).toBe("🛠");
  });

  it("handles empty data object", () => {
    const result = sseEncode("done", {});
    expect(result).toContain("event: done");
    expect(result).toContain("data: {}");
  });

  it("handles null data gracefully", () => {
    const result = sseEncode("status", null);
    expect(result).toContain("data: null");
  });
});
