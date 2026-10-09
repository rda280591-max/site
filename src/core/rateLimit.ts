// ORBIT — lightweight in-memory rate limiter (stale-while-prune, no global timer)
// SECURITY goal: slow brute-force/spam on sensitive endpoints (/api/*, auth flow).
// NOTE inherent serverless limit: counting is per-instance; the real first layer is WAF/edge.
// Zero-dependency module under 1KB -> no impact on bundle/runtime.

export interface RateLimiter {
  /** true when the request is allowed; otherwise false + retry headers */
  check(key: string): { allowed: boolean; retryAfterSeconds: number };
}

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

/**
 /* @param limit  max requests within the window
 /* @param windowSeconds window length (seconds)
 */
export function createRateLimiter(limit: number, windowSeconds: number): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const windowMs = windowSeconds * 1000;
  let lastPrune = Date.now();

  return {
    check(key: string) {
      const now = Date.now();

      // Statistical prune: once per 2x window, drop expired keys (O(n), rare)
      if (now - lastPrune > windowMs * 2) {
        lastPrune = now;
        for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      }

      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      bucket.count += 1;
      if (bucket.count > limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/** Stable key from IP (behind Vercel CDN: first x-forwarded-for value) */
export function ipKey(request: Request | Headers): string {
  const headers = request instanceof Headers ? request : request.headers;
  const fwd = headers.get('x-forwarded-for');
  const ip = (fwd?.split(',')[0] ?? '').trim() || 'local';
  return ip;
}

/** Standard 429 body + Retry-After */
export function tooManyResponse(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({ error: 'درخواست‌های زیاد است. کمی بعد دوباره تلاش کنید.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': String(retryAfterSeconds),
        'Cache-Control': 'no-store',
      },
    },
  );
}
