import { describe, expect, it } from "vitest";
import { suggestGame } from "./game-recommend";

describe("suggestGame — topic routing", () => {
  it("routes coding to Code Spark", () => {
    const r = suggestGame({ text: "帮我学编程 scratch loop" });
    expect(r?.gameId).toBe("code-spark");
  });

  it("honors preferredGameId", () => {
    const r = suggestGame({ text: "fractions", preferredGameId: "code-spark" });
    expect(r?.gameId).toBe("code-spark");
  });
  it("routes fractions to Fraction Voyager", () => {
    const r = suggestGame({ text: "we learned about 分数 and number lines" });
    expect(r?.gameId).toBe("fraction-voyager");
  });

  it("routes ecosystems to Eco Genesis", () => {
    const r = suggestGame({ tags: ["science", "ecosystem", "food chain"] });
    expect(r?.gameId).toBe("eco-genesis");
  });

  it("routes history to Time Vault", () => {
    const r = suggestGame({ text: "今天学了历史时间线 ancient civilizations" });
    expect(r?.gameId).toBe("time-vault");
  });

  it("routes force/gravity to Force Bay", () => {
    const r = suggestGame({ text: "forces push and pull 力 运动" });
    expect(r?.gameId).toBe("force-bay");
  });

  it("routes space/orbit to Orbit Scout", () => {
    const r = suggestGame({ text: "planets and orbits 卫星 太空" });
    expect(r?.gameId).toBe("orbit-scout");
  });
});

describe("suggestGame — fallback", () => {
  it("returns a learning game for empty hints", () => {
    const r = suggestGame({});
    expect(r).not.toBeNull();
    expect([
      "code-spark",
      "fraction-voyager",
      "eco-genesis",
      "orbit-scout",
      "word-echo",
    ]).toContain(r!.gameId);
    expect(r!.line).toBeTruthy();
  });

  it("returns a deterministic learning game for unrelated text", () => {
    const a = suggestGame({ text: "hello world" });
    const b = suggestGame({ text: "hello world" });
    expect(a?.gameId).toBe(b?.gameId);
    expect(a).not.toBeNull();
  });
});
