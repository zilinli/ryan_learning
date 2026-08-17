/**
 * LLM fallback layer — OpenAI-compatible streaming chat completions used when
 * the primary Cursor Agent path fails (no key, agent start error, run error).
 *
 * Providers (checked in order):
 *   1. DeepSeek  — env DEEPSEEK_API_KEY   → https://api.deepseek.com/v1
 *   2. 百炼 Qwen — env ALIYUN_DASHSCOPE_API_KEY | DASHSCOPE_API_KEY
 *                  → https://dashscope.aliyuncs.com/compatible-mode/v1
 *
 * Model overrides: LLM_FALLBACK_MODEL (default deepseek-chat / qwen-plus).
 */

export type LlmFallbackProvider = "deepseek" | "dashscope";

export type LlmFallbackConfig = {
  provider: LlmFallbackProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function loadLlmFallbackConfig(): LlmFallbackConfig | null {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseekKey) {
    return {
      provider: "deepseek",
      baseUrl: process.env.LLM_FALLBACK_BASE_URL?.trim() ||
        "https://api.deepseek.com/v1",
      apiKey: deepseekKey,
      model: process.env.LLM_FALLBACK_MODEL?.trim() || "deepseek-chat",
    };
  }
  const dashscopeKey =
    process.env.ALIYUN_DASHSCOPE_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim();
  if (dashscopeKey) {
    return {
      provider: "dashscope",
      baseUrl: process.env.LLM_FALLBACK_BASE_URL?.trim() ||
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: dashscopeKey,
      model: process.env.LLM_FALLBACK_MODEL?.trim() || "qwen-plus",
    };
  }
  return null;
}

export function hasLlmFallback(): boolean {
  return loadLlmFallbackConfig() !== null;
}

export type LlmFallbackHandlers = {
  onText: (delta: string) => void;
  onStatus?: (status: string) => void;
};

export async function streamLlmFallback(params: {
  text: string;
  signal?: AbortSignal;
  handlers: LlmFallbackHandlers;
}): Promise<{ provider: LlmFallbackProvider; fullText: string }> {
  const config = loadLlmFallbackConfig();
  if (!config) {
    throw new Error("LLM fallback not configured (no DEEPSEEK/DASHSCOPE key)");
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "user",
          content: params.text,
        },
      ],
      stream: true,
      temperature: 0.7,
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `LLM fallback (${config.provider}) HTTP ${res.status}: ${errText.slice(0, 300)}`,
    );
  }

  params.handlers.onStatus?.(
    config.provider === "deepseek" ? "Using DeepSeek backup…" : "Using Qwen backup…",
  );

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE: split on blank lines; each event is `data: {...}` possibly multiline
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const ev of events) {
        const dataLine = ev
          .split("\n")
          .find((l) => l.startsWith("data:"))
          ?.slice(5)
          .trim();
        if (!dataLine || dataLine === "[DONE]") continue;
        try {
          const json = JSON.parse(dataLine) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            params.handlers.onText(delta);
          }
        } catch {
          // ignore malformed keep-alive / partial lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText.trim()) {
    throw new Error(`LLM fallback (${config.provider}) returned empty text`);
  }
  return { provider: config.provider, fullText };
}
