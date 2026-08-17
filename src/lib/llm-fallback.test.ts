/** @vitest-environment node */

import { describe, expect, it, vi, afterEach } from "vitest";
import {
  hasLlmFallback,
  loadLlmFallbackConfig,
  streamLlmFallback,
} from "./llm-fallback";

const ORIGINAL_ENV = { ...process.env };

function mockSseResponse(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(new TextEncoder().encode(c));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("loadLlmFallbackConfig", () => {
  it("returns null when no fallback key is configured", () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    expect(loadLlmFallbackConfig()).toBeNull();
    expect(hasLlmFallback()).toBe(false);
  });

  it("prefers DeepSeek when its key is present", () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    const cfg = loadLlmFallbackConfig();
    expect(cfg?.provider).toBe("deepseek");
    expect(cfg?.baseUrl).toContain("api.deepseek.com");
    expect(cfg?.model).toBe("deepseek-chat");
  });

  it("falls back to DashScope when only its key is present", () => {
    delete process.env.DEEPSEEK_API_KEY;
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-dashscope-test";
    const cfg = loadLlmFallbackConfig();
    expect(cfg?.provider).toBe("dashscope");
    expect(cfg?.baseUrl).toContain("dashscope.aliyuncs.com");
    expect(cfg?.model).toBe("qwen-plus");
  });
});

describe("streamLlmFallback", () => {
  it("streams deltas from an OpenAI-compatible SSE response", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      mockSseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo!"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const { provider, fullText } = await streamLlmFallback({
      text: "Say hi",
      handlers: { onText: (d) => deltas.push(d) },
    });

    expect(provider).toBe("deepseek");
    expect(deltas.join("")).toBe("Hello!");
    expect(fullText).toBe("Hello!");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("/chat/completions");
    const body = JSON.parse(String(init?.body));
    expect(body.stream).toBe(true);
    expect(body.messages[0].content).toBe("Say hi");
  });

  it("throws when the provider returns a non-OK status", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("over quota", { status: 429 })),
    );

    await expect(
      streamLlmFallback({ text: "x", handlers: { onText: () => {} } }),
    ).rejects.toThrow(/HTTP 429/);
  });

  it("throws when not configured", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    await expect(
      streamLlmFallback({ text: "x", handlers: { onText: () => {} } }),
    ).rejects.toThrow(/not configured/);
  });
});
