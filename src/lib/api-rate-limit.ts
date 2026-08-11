/**
 * RPT2.2 — Lightweight in-process sliding-window rate limit for costly APIs.
 * Single Node process today (pm2 spark-tutor). Not a substitute for edge auth.
 */

export type RateLimitBucket = {
  /** Max hits allowed inside the window */
  limit: number;
  /** Window length in ms */
  windowMs: number;
};

/** Presets tuned for a family deploy (generous for Ryan, hostile to scrapers). */
export const RATE_PRESETS = {
  /** Cursor Agent tutoring / console / FAQ / translate */
  agent: { limit: 30, windowMs: 60_000 } satisfies RateLimitBucket,
  /** TTS / STT */
  voice: { limit: 60, windowMs: 60_000 } satisfies RateLimitBucket,
  /** Lightweight introspective endpoints */
  models: { limit: 20, windowMs: 60_000 } satisfies RateLimitBucket,
  /** Entertain AI moves */
  entertain: { limit: 40, windowMs: 60_000 } satisfies RateLimitBucket,
} as const;

const hitsByKey = new Map<string, number[]>();

/** Test helper — clear all buckets. */
export function resetApiRateLimitForTests(): void {
  hitsByKey.clear();
}

export function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff.slice(0, 64);
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "127.0.0.1";
}

/**
 * Record a hit for `bucketKey` (usually `${route}:${ip}`).
 * Returns whether the request is over the limit AFTER counting this hit.
 */
export function isRateLimited(
  bucketKey: string,
  bucket: RateLimitBucket,
  now = Date.now(),
): boolean {
  const key = String(bucketKey || "unknown").slice(0, 128);
  const windowStart = now - bucket.windowMs;
  const prev = hitsByKey.get(key) ?? [];
  const kept = prev.filter((t) => t > windowStart);
  kept.push(now);
  hitsByKey.set(key, kept);
  // Bound map growth for long-lived process
  if (hitsByKey.size > 5_000) {
    for (const [k, times] of hitsByKey) {
      const fresh = times.filter((t) => t > windowStart);
      if (fresh.length === 0) hitsByKey.delete(k);
      else hitsByKey.set(k, fresh);
    }
  }
  return kept.length > bucket.limit;
}

export function rateLimitResponse(retryAfterSec = 60): Response {
  return Response.json(
    {
      error: "Too many requests — wait a moment and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.floor(retryAfterSec))),
        "Cache-Control": "no-store",
      },
    },
  );
}

/** Convenience: IP from request + route tag → 429 Response or null. */
export function checkApiRateLimit(
  req: Request,
  route: string,
  bucket: RateLimitBucket,
): Response | null {
  const ip = clientIpFromRequest(req);
  const over = isRateLimited(`${route}:${ip}`, bucket);
  if (!over) return null;
  return rateLimitResponse(Math.ceil(bucket.windowMs / 1000));
}
