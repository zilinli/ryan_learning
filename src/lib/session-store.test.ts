import { describe, expect, it } from "vitest";
import {
  clearAgentId,
  getAgentId,
  setAgentId,
} from "./session-store";

describe("session-store LRU", () => {
  it("stores and retrieves agent ids", () => {
    setAgentId("s1", "agent-1");
    expect(getAgentId("s1")).toBe("agent-1");
    clearAgentId("s1");
    expect(getAgentId("s1")).toBeUndefined();
  });

  it("evicts oldest sessions past capacity (40)", () => {
    const prefix = `lru_${Date.now()}_`;
    for (let i = 0; i < 45; i += 1) {
      setAgentId(`${prefix}${i}`, `agent-${i}`);
    }
    expect(getAgentId(`${prefix}0`)).toBeUndefined();
    expect(getAgentId(`${prefix}4`)).toBeUndefined();
    expect(getAgentId(`${prefix}44`)).toBe("agent-44");
    expect(getAgentId(`${prefix}5`)).toBe("agent-5");
  });

  it("refreshes LRU on get so hot sessions survive", () => {
    const prefix = `hot_${Date.now()}_`;
    setAgentId(`${prefix}keep`, "keep-me");
    for (let i = 0; i < 39; i += 1) {
      setAgentId(`${prefix}${i}`, `a-${i}`);
    }
    // Touch keep so it becomes newest before next insert wave
    expect(getAgentId(`${prefix}keep`)).toBe("keep-me");
    for (let i = 39; i < 50; i += 1) {
      setAgentId(`${prefix}${i}`, `a-${i}`);
    }
    expect(getAgentId(`${prefix}keep`)).toBe("keep-me");
  });
});
