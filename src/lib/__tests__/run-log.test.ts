import { describe, it, expect } from "vitest";
import { appendRunLog, getLastRun, getRecentRuns, getErrorRate } from "../run-log";

describe("Agent Run Log", () => {
  it("exports all functions", () => {
    expect(typeof appendRunLog).toBe("function");
    expect(typeof getLastRun).toBe("function");
    expect(typeof getRecentRuns).toBe("function");
    expect(typeof getErrorRate).toBe("function");
  });

  it("appendRunLog is callable (writes to logs/agent-runs.jsonl)", async () => {
    await expect(
      appendRunLog({
        timestamp: new Date().toISOString(),
        sessionId: "test-s1",
        agentId: "agent-1",
        runId: "run-1",
        status: "completed",
        durationMs: 500,
        model: "auto",
      })
    ).resolves.toBeUndefined();
  });

  it("getLastRun returns null when no runs match agent", async () => {
    const result = await getLastRun("nonexistent-agent");
    expect(result).toBeNull();
  });

  it("getRecentRuns returns array", async () => {
    const runs = await getRecentRuns(10);
    expect(Array.isArray(runs)).toBe(true);
  });

  it("getErrorRate returns sensible defaults", async () => {
    const rate = await getErrorRate(60);
    expect(rate).toHaveProperty("total");
    expect(rate).toHaveProperty("errors");
    expect(rate).toHaveProperty("rate");
    expect(rate.rate).toBeGreaterThanOrEqual(0);
    expect(rate.rate).toBeLessThanOrEqual(1);
  });
});
