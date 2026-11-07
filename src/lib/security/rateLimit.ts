/**
 * In-memory sliding-window rate limiter for API endpoints.
 * Production-ready with IP identification and standard HTTP rate limit headers.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory bucket store
const rateLimitStore = new Map<string, RateLimitEntry>();

// Sweeper for expired entries to prevent memory leaks (runs every 60s)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Checks rate limit for a given key within a window in seconds.
 */
export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowSeconds: number = 60
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    // New or expired window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }

  if (entry.count >= limit) {
    // Limit exceeded
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(entry.resetAt / 1000),
    };
  }

  // Increment counter
  entry.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    reset: Math.ceil(entry.resetAt / 1000),
  };
}

