import { CursorAgentError } from "@cursor/sdk";

export interface RetryConfig {
  maxRetries: number;        // default: 3
  baseDelayMs: number;       // default: 1000
  maxDelayMs: number;        // default: 8000
  staleSessionRetryCount: number; // default: 1 (separate from main retries)
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  staleSessionRetryCount: 1,
};

/** Bare run.wait() status:error with no error field — likely stale session. */
export function isStaleSessionError(err: unknown): boolean {
  if (err instanceof Error && err.message.includes("bare error")) return true;
  if (err instanceof CursorAgentError && (err as unknown as Record<string, unknown>).protoErrorCode === 16) return true;
  return false;
}

/** Retryable Cursor SDK errors (rate limits, transient auth). */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof CursorAgentError && err.isRetryable) return true;
  // Rate limit with proto error 8
  if (err instanceof CursorAgentError && (err as unknown as Record<string, unknown>).protoErrorCode === 8) return true;
  return false;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  let staleRetries = 0;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      // Stale session: one immediate retry (the operation should create a fresh agent)
      if (isStaleSessionError(err) && staleRetries < cfg.staleSessionRetryCount) {
        staleRetries += 1;
        continue;
      }

      // Non-retryable or exhausted
      if (attempt >= cfg.maxRetries || !isRetryableError(err)) {
        throw err;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        cfg.baseDelayMs * Math.pow(2, attempt) + Math.random() * 200,
        cfg.maxDelayMs,
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}
