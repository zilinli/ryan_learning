import { afterEach, describe, expect, it } from "vitest";
import {
  serverIpLimitAdvice,
  volcEgressHint,
  volcHttpsProxyUrl,
  volcRelayUrl,
} from "./volc-fetch";

describe("volc-fetch egress helpers", () => {
  const keys = [
    "VOLC_MUSIC_HTTPS_PROXY",
    "HTTPS_PROXY",
    "https_proxy",
    "VOLC_MUSIC_RELAY_URL",
  ];
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function stash() {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  }

  it("reads proxy and relay env", () => {
    stash();
    expect(volcHttpsProxyUrl()).toBeNull();
    expect(volcRelayUrl()).toBeNull();
    expect(volcEgressHint()).toBe("direct");

    process.env.VOLC_MUSIC_HTTPS_PROXY = "http://127.0.0.1:3128";
    expect(volcHttpsProxyUrl()).toContain("3128");
    expect(volcEgressHint()).toBe("https-proxy");

    process.env.VOLC_MUSIC_RELAY_URL = "https://cn.example/volc-relay";
    expect(volcRelayUrl()).toContain("volc-relay");
    expect(volcEgressHint()).toBe("relay+https-proxy");
  });

  it("ServerIpLimit advice mentions CN relay and Bailian", () => {
    const tip = serverIpLimitAdvice();
    expect(tip).toMatch(/ServerIpLimit/);
    expect(tip).toMatch(/VOLC_MUSIC_RELAY_URL/);
    expect(tip).toMatch(/Bailian|Fun-Music/i);
    expect(tip).toMatch(/free proxies are unsafe/i);
  });
});
