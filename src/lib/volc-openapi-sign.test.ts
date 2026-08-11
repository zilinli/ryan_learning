import { describe, expect, it } from "vitest";
import { signVolcOpenApi, volcQueryString } from "./volc-openapi-sign";

describe("volc-openapi-sign", () => {
  it("builds deterministic Authorization for fixed now", () => {
    const now = new Date("2025-12-01T10:38:33.000Z");
    const body = JSON.stringify({ Prompt: "关于星空的歌" });
    const headers = signVolcOpenApi({
      method: "POST",
      host: "open.volcengineapi.com",
      query: { Action: "GenSongForTime", Version: "2024-08-12" },
      body,
      accessKeyId: "AKLTTEST",
      secretKey: "secret-test-key",
      region: "cn-beijing",
      service: "imagination",
      now,
    });
    expect(headers["X-Date"]).toBe("20251201T103833Z");
    expect(headers["X-Content-Sha256"]).toMatch(/^[a-f0-9]{64}$/);
    expect(headers.Authorization).toContain("HMAC-SHA256 Credential=AKLTTEST/");
    expect(headers.Authorization).toContain("cn-beijing/imagination/request");
    expect(headers.Authorization).toContain("Signature=");
  });

  it("encodes query stably", () => {
    expect(
      volcQueryString({ Version: "2024-08-12", Action: "QuerySong" }),
    ).toBe("Action=QuerySong&Version=2024-08-12");
  });
});
