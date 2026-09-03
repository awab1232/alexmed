// Best-effort per-key abuse guard for the PDF/LLM endpoints (fixed window via
// Redis INCR+EXPIRE). Fails OPEN if Redis is unreachable — this protects the
// LLM bill, it is not a hard security boundary, so a Redis outage must not
// take the product feature down with it.
import Redis from "ioredis";

let client: Redis | null = null;
let attemptedConnect = false;

function getClient(): Redis | null {
  if (!attemptedConnect) {
    attemptedConnect = true;
    const url = process.env.REDIS_URL;
    if (url) {
      client = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      client.on("error", error =>
        console.warn("[RateLimit] Redis error:", error.message)
      );
    }
  }
  return client;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const redis = getClient();
  if (!redis) return true; // no REDIS_URL configured — allow (dev convenience)

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch (error) {
    console.warn("[RateLimit] check failed, allowing request:", error);
    return true;
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
