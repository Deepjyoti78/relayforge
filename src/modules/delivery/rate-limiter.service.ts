import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { safeError } from '../observability/logging';

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds: number;
  currentUsage?: number;
  limit?: number;
}

const LUA_SLIDING_WINDOW_RATE_LIMIT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('get', key) or "0")

if current < limit then
  local count = redis.call('incr', key)
  if count == 1 then
    redis.call('expire', key, 1)
  end
  return {1, count, 0}
else
  local ttl = redis.call('ttl', key)
  if ttl <= 0 then
    ttl = 1
  end
  return {0, current, ttl}
end
`;

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Evaluates if an outbound delivery is within the per-destination throughput rate limit.
   * Uses an atomic Redis token window. If the destination exceeds rate_limit_per_second,
   * delivery should be postponed rather than causing HTTP 429s or burning retry attempts.
   */
  async checkRateLimit(
    destinationId: string,
    rateLimitPerSecond: number,
  ): Promise<RateLimitCheckResult> {
    if (!rateLimitPerSecond || rateLimitPerSecond <= 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const key = `ratelimit:dest:${destinationId}`;
    try {
      const res = (await this.redisService.connection.eval(
        LUA_SLIDING_WINDOW_RATE_LIMIT,
        1,
        key,
        rateLimitPerSecond.toString(),
      )) as [number, number, number];

      const allowed = res[0] === 1;
      const currentUsage = res[1];
      const retryAfterSeconds = res[2];

      if (!allowed) {
        this.logger.warn({
          event: 'destination_rate_limit_throttled',
          destinationId,
          rateLimitPerSecond,
          currentUsage,
          retryAfterSeconds,
        });
      }

      return {
        allowed,
        retryAfterSeconds: allowed ? 0 : Math.max(1, retryAfterSeconds),
        currentUsage,
        limit: rateLimitPerSecond,
      };
    } catch (err: unknown) {
      this.logger.error({
        event: 'rate_limit_check_error',
        destinationId,
        error: safeError(err),
      });
      // Fail open to avoid blocking deliveries if Redis rate limiter fails
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }
}
