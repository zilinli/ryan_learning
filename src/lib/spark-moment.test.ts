import { describe, expect, it } from "vitest";
import {
  parseSparkFence,
  stripSparkFence,
} from "./spark-moment";

describe("spark-moment (Report-v3 R8)", () => {
  it("parses spark fence JSON", () => {
    const text = `Nice link!\n~~~spark\n{"title":"Fractions meet pyramids","subjects":["math","humanities"]}\n~~~\nMore.`;
    expect(parseSparkFence(text)).toEqual({
      title: "Fractions meet pyramids",
      subjects: ["math", "humanities"],
    });
    expect(stripSparkFence(text)).toBe("Nice link!\n\nMore.");
  });
});
