import { describe, expect, it } from "vitest";
import {
  collapseDiagramsInMessages,
  collapseSameDiagramImages,
  formatDiagramAlt,
  parseDiagramAlt,
} from "./diagram-lifecycle";

const img = (alt: string, mark: string) =>
  `![${alt}](data:image/svg+xml;base64,${Buffer.from(`<svg>${mark}</svg>`).toString("base64")})`;

describe("diagram-lifecycle (CA-8)", () => {
  it("DB1: parse/format alt + collapse same id keeps higher revision", () => {
    expect(parseDiagramAlt("geo:tri1:2 Right triangle")).toEqual({
      diagramId: "tri1",
      revision: 2,
      title: "Right triangle",
    });
    expect(formatDiagramAlt("tri1", 2, "T")).toBe("geo:tri1:2 T");
    const md = `${img("geo:tri1:1 old", "A")}\n${img("geo:tri1:2 new", "B")}`;
    const out = collapseSameDiagramImages(md);
    expect(out).toContain("geo:tri1:2");
    expect(out).not.toContain("geo:tri1:1");
  });

  it("DB2: across messages older same-id becomes update note", () => {
    const msgs = [
      {
        role: "assistant",
        content: `See:\n${img("geo:tri1:1 v1", "A")}`,
      },
      {
        role: "assistant",
        content: `Updated:\n${img("geo:tri1:2 v2", "B")}`,
      },
    ];
    const out = collapseDiagramsInMessages(msgs);
    expect(out[0]!.content).toMatch(/updated figure tri1/i);
    expect(out[1]!.content).toContain("geo:tri1:2");
  });
});
