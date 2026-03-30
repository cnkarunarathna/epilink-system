import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Wraps the Redis client directly to work around the cache-manager v7 +
 * cache-manager-redis-store v2 TTL incompatibility.
 *
 * cache-manager v7 passes TTL as a plain number to store.set(), but
 * cache-manager-redis-store v2 expects { ttl } options object (cache-manager v4
 * style). This mismatch causes all per-call TTLs to be silently ignored and
 * the module-level default to be used instead.
 *
 * This service bypasses the abstraction layer and calls SETEX directly so that
 * each cached method gets the exact TTL it requests.
 */
@Injectable()
export class CacheHelperService {
  private redisClient: any;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    const store = (cacheManager as any).store;
    this.redisClient = store?.getClient?.() ?? store?.client ?? null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redisClient) {
      const raw: string | null = await this.redisClient.get(key);
      if (raw === null || raw === undefined) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    return (await this.cacheManager.get<T>(key)) ?? null;
  }

  /** ttlMs — time-to-live in **milliseconds** (consistent with cache-manager v7 API) */
  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    if (this.redisClient) {
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      await this.redisClient.setex(key, ttlSeconds, JSON.stringify(value));
      return;
    }
    await this.cacheManager.set(key, value, ttlMs);
  }

  async del(key: string): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.del(key);
      return;
    }
    await this.cacheManager.del(key);
  }

  /** Delete all keys matching a glob pattern (e.g. 'tasks:*'). */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.redisClient) return;
    try {
      const keys: string[] = await this.redisClient.keys(pattern);
      if (keys.length > 0) await this.redisClient.del(...keys);
    } catch {
      // Non-fatal: cache invalidation failure should never break a write path
    }
  }
}
