import { describe, it, expect, beforeEach } from "vitest";
import {
  RATE_PRESETS,
  checkApiRateLimit,
  clientIpFromRequest,
  isRateLimited,
  resetApiRateLimitForTests,
} from "./api-rate-limit";

describe("api-rate-limit (RPT2.2)", () => {
  beforeEach(() => {
    resetApiRateLimitForTests();
  });

  it("allows traffic under the limit", () => {
    const bucket = { limit: 3, windowMs: 60_000 };
    expect(isRateLimited("t:a", bucket, 1_000)).toBe(false);
    expect(isRateLimited("t:a", bucket, 1_100)).toBe(false);
    expect(isRateLimited("t:a", bucket, 1_200)).toBe(false);
  });

  it("blocks the hit that exceeds the limit", () => {
    const bucket = { limit: 2, windowMs: 60_000 };
    expect(isRateLimited("t:b", bucket, 1_000)).toBe(false);
    expect(isRateLimited("t:b", bucket, 1_100)).toBe(false);
    expect(isRateLimited("t:b", bucket, 1_200)).toBe(true);
  });

  it("expires hits outside the window", () => {
    const bucket = { limit: 1, windowMs: 1_000 };
    expect(isRateLimited("t:c", bucket, 1_000)).toBe(false);
    expect(isRateLimited("t:c", bucket, 1_500)).toBe(true);
    // 2501: prior hits fall outside [1501, 2501]
    expect(isRateLimited("t:c", bucket, 2_501)).toBe(false);
  });

  it("isolates buckets by key", () => {
    const bucket = { limit: 1, windowMs: 60_000 };
    expect(isRateLimited("chat:1.1.1.1", bucket, 1_000)).toBe(false);
    expect(isRateLimited("chat:2.2.2.2", bucket, 1_000)).toBe(false);
    expect(isRateLimited("chat:1.1.1.1", bucket, 1_100)).toBe(true);
  });

  it("reads client IP from x-forwarded-for", () => {
    const req = new Request("http://localhost/api/chat", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientIpFromRequest(req)).toBe("203.0.113.9");
  });

  it("checkApiRateLimit returns 429 Response when over", () => {
    const req = new Request("http://localhost/api/models", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    const tight = { limit: 1, windowMs: 60_000 };
    expect(checkApiRateLimit(req, "models", tight)).toBeNull();
    const blocked = checkApiRateLimit(req, "models", tight);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("exposes sensible presets", () => {
    expect(RATE_PRESETS.agent.limit).toBeGreaterThan(0);
    expect(RATE_PRESETS.voice.windowMs).toBe(60_000);
  });
});
