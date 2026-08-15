import { describe, expect, it } from "vitest";
import { LAB_RYAN_EDGE_VOICE } from "@/hooks/useRyanBritishListen";

describe("lab Ryan British Listen (LDV)", () => {
  it("LDV1 hard-locks Edge British Ryan ShortName", () => {
    expect(LAB_RYAN_EDGE_VOICE).toBe("en-GB-RyanNeural");
  });
});
