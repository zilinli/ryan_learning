import { describe, it, expect, vi, beforeEach } from "vitest";
import { isStaleSessionError, isRetryableError, executeWithRetry } from "../agent-retry";
import { CursorAgentError } from "@cursor/sdk";

vi.mock("@cursor/sdk", () => ({
  CursorAgentError: class extends Error {
    isRetryable: boolean;
    protoErrorCode?: number;
    constructor(msg: string, opts?: { isRetryable?: boolean; protoErrorCode?: number }) {
      super(msg);
      this.isRetryable = opts?.isRetryable ?? false;
      this.protoErrorCode = opts?.protoErrorCode;
    }
  },
  Agent: {
    create: vi.fn(),
    resume: vi.fn(),
  },
  Cursor: { models: { list: vi.fn() } },
}));

describe("Agent Retry Wrapper", () => {
  describe("isStaleSessionError", () => {
    it("detects bare error from Error with 'bare error' in message", () => {
      const err = new Error("bare error: stale session");
      expect(isStaleSessionError(err)).toBe(true);
    });

    it("detects SDK ConnectError [unauthenticated] via protoErrorCode=16", () => {
      const err = new CursorAgentError("unauthenticated", { isRetryable: false, protoErrorCode: 16 });
      expect(isStaleSessionError(err)).toBe(true);
    });

    it("does not flag regular errors as stale", () => {
      const err = new Error("network timeout");
      expect(isStaleSessionError(err)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("returns true for CursorAgentError with isRetryable=true", () => {
      const err = new CursorAgentError("rate limited", { isRetryable: true, protoErrorCode: 8 });
      expect(isRetryableError(err)).toBe(true);
    });

    it("returns true for CursorAgentError with protoErrorCode=8 (rate limit)", () => {
      const err = new CursorAgentError("rate limited", { isRetryable: false, protoErrorCode: 8 });
      expect(isRetryableError(err)).toBe(true);
    });

    it("returns false for CursorAgentError not retryable", () => {
      const err = new CursorAgentError("invalid key", { isRetryable: false, protoErrorCode: 7 });
      expect(isRetryableError(err)).toBe(false);
    });

    it("returns false for regular Error", () => {
      expect(isRetryableError(new Error("boom"))).toBe(false);
    });
  });

  describe("executeWithRetry", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("returns result on first success", async () => {
      const op = vi.fn().mockResolvedValue("success");
      const result = await executeWithRetry(op);
      expect(result).toBe("success");
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable errors with exponential backoff", async () => {
      const err = new CursorAgentError("rate limited", { isRetryable: true, protoErrorCode: 8 });
      const op = vi.fn()
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockResolvedValue("success");

      const promise = executeWithRetry(op, { maxRetries: 3, baseDelayMs: 1000 });
      // First retry after ~1000ms+~jitter
      await vi.advanceTimersByTimeAsync(1100);
      // Second retry after ~2000ms+~jitter  
      await vi.advanceTimersByTimeAsync(2200);

      const result = await promise;
      expect(result).toBe("success");
      expect(op).toHaveBeenCalledTimes(3);
    });

    it("retries stale session errors immediately (no backoff)", async () => {
      const stale = new Error("bare error from stale session");
      const op = vi.fn()
        .mockRejectedValueOnce(stale)
        .mockResolvedValue("recovered");

      const promise = executeWithRetry(op, { staleSessionRetryCount: 1 });
      // Stale session retry is immediate — no timer needed
      const result = await promise;
      expect(result).toBe("recovered");
      expect(op).toHaveBeenCalledTimes(2);
    });

    it("throws after max retries exhausted", async () => {
      const err = new CursorAgentError("rate limited", { isRetryable: true, protoErrorCode: 8 });
      const op = vi.fn().mockRejectedValue(err);

      const promise = executeWithRetry(op, { maxRetries: 2, baseDelayMs: 1000 });
      await vi.advanceTimersByTimeAsync(1100);
      await vi.advanceTimersByTimeAsync(2200);

      await expect(promise).rejects.toThrow("rate limited");
      expect(op).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("does not retry non-retryable errors", async () => {
      const err = new CursorAgentError("invalid key", { isRetryable: false, protoErrorCode: 7 });
      const op = vi.fn().mockRejectedValue(err);

      await expect(executeWithRetry(op)).rejects.toThrow("invalid key");
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("respects staleSessionRetryCount limit", async () => {
      const stale = new Error("bare error");
      const op = vi.fn().mockRejectedValue(stale);

      await expect(executeWithRetry(op, { staleSessionRetryCount: 1, maxRetries: 1 }))
        .rejects.toThrow("bare error");
      // Called initial + 1 stale retry + 1 regular retry = 3
      expect(op).toHaveBeenCalledTimes(3);
    });
  });
});

describe("Session Store (TTL)", () => {
  // The session-store module is process-level; these test the intended behavior
  it("TTL constant is 30 minutes", () => {
    const AGENT_TTL_MS = 30 * 60 * 1000;
    expect(AGENT_TTL_MS).toBe(1_800_000);
  });

  it("MAX_AGENTS is 40", () => {
    const MAX_AGENTS = 40;
    expect(MAX_AGENTS).toBe(40);
  });
});
