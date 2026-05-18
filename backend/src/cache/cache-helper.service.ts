import { Injectable, Inject, Logger } from '@nestjs/common';
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

interface SWREntry<T> {
  __swr__: true;
  data: T;
  /** Unix ms timestamp after which the entry is considered stale (still served, but triggers background refresh). */
  freshUntil: number;
}

@Injectable()
export class CacheHelperService {
  private readonly logger = new Logger(CacheHelperService.name);
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

  /**
   * Atomically increment an integer counter and (re-)set its TTL.
   * Uses a Redis pipeline so both INCR and PEXPIRE go in a single round-trip.
   * Falls back to a non-atomic get-increment-set when Redis is unavailable.
   */
  async incr(key: string, ttlMs: number): Promise<number> {
    if (this.redisClient) {
      const results = await this.redisClient
        .pipeline()
        .incr(key)
        .pexpire(key, ttlMs)
        .exec();
      return (results[0][1] as number);
    }
    const current = (await this.cacheManager.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.cacheManager.set(key, next, ttlMs);
    return next;
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
    if (!this.redisClient) {
      // No direct Redis client — clear the entire in-process cache so stale
      // entries don't persist until their TTL expires.
      try {
        await this.cacheManager.clear();
      } catch (err) {
        this.logger.warn(
          `delByPattern("${pattern}"): in-process cache clear failed: ${err instanceof Error ? err.message : err}`,
        );
      }
      return;
    }
    try {
      const keys: string[] = await this.redisClient.keys(pattern);
      if (keys.length > 0) await this.redisClient.del(...keys);
    } catch (err) {
      this.logger.warn(
        `Cache invalidation failed for pattern "${pattern}": ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Stale-While-Revalidate (SWR) cache accessor.
   *
   * Behaviour:
   *  - Fresh entry (within ttlMs):  returned instantly, no DB hit.
   *  - Stale entry (past ttlMs but within graceMs): returned instantly from
   *    cache AND a background refresh is triggered so the next caller gets
   *    fresh data. The current request never waits.
   *  - Hard miss (key absent, past ttlMs + graceMs): fetcher is awaited once,
   *    then the result is stored. This only happens on cold start or after a
   *    very long idle period.
   *
   * Thundering-herd protection: a Redis SET NX lock prevents multiple
   * concurrent background refreshes for the same key.
   *
   * @param key      Cache key (must be unique per logical dataset + params)
   * @param ttlMs    How long data is "fresh" in milliseconds
   * @param fetcher  Async function that fetches fresh data from the source
   * @param graceMs  How long stale data is still served while refreshing
   *                 (default: equals ttlMs, so data is kept for 2× ttlMs total)
   */
  async getOrRefresh<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
    graceMs: number = ttlMs,
  ): Promise<T> {
    if (this.redisClient) {
      const raw: string | null = await this.redisClient.get(key);
      if (raw !== null && raw !== undefined) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed as SWREntry<T>).__swr__ === true) {
            const entry = parsed as SWREntry<T>;
            if (entry.freshUntil > Date.now()) {
              // Entry is fresh — serve immediately
              return entry.data;
            }
            // Entry is stale but within grace window — serve stale data and
            // kick off a background refresh without making the caller wait.
            this.triggerBackgroundRefresh(key, ttlMs, graceMs, fetcher);
            return entry.data;
          }
        } catch {
          // Corrupted or legacy-format entry — fall through to hard fetch
        }
      }

      // Hard miss: block until we have fresh data (cold start only)
      const data = await fetcher();
      await this.writeSWREntry(key, data, ttlMs, graceMs);
      return data;
    }

    // ── Fallback path: Redis unavailable, use in-process cache-manager ──
    const cached = await this.cacheManager.get<T>(key);
    if (cached !== undefined && cached !== null) return cached;
    const data = await fetcher();
    await this.cacheManager.set(key, data, ttlMs);
    return data;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private triggerBackgroundRefresh<T>(
    key: string,
    ttlMs: number,
    graceMs: number,
    fetcher: () => Promise<T>,
  ): void {
    const lockKey = `${key}:refresh_lock`;
    // Fire-and-forget — intentionally not awaited so the caller is never blocked
    void (async () => {
      try {
        // Acquire a distributed lock so only one instance refreshes at a time.
        // Lock TTL is capped to the fetcher's expected duration + buffer.
        const lockTtlSec = Math.max(10, Math.ceil(ttlMs / 1000));
        const acquired: string | null = await this.redisClient.set(
          lockKey,
          '1',
          'EX',
          lockTtlSec,
          'NX',
        );
        if (!acquired) return; // Another instance already holds the lock

        try {
          const data = await fetcher();
          await this.writeSWREntry(key, data, ttlMs, graceMs);
        } finally {
          await this.redisClient.del(lockKey);
        }
      } catch (err) {
        this.logger.warn(
          `Background SWR refresh failed for key "${key}": ${err instanceof Error ? err.message : err}`,
        );
      }
    })();
  }

  private async writeSWREntry<T>(
    key: string,
    data: T,
    ttlMs: number,
    graceMs: number,
  ): Promise<void> {
    const entry: SWREntry<T> = {
      __swr__: true,
      data,
      freshUntil: Date.now() + ttlMs,
    };
    // Keep the key alive for the full fresh + grace window
    const totalTtlSeconds = Math.max(1, Math.ceil((ttlMs + graceMs) / 1000));
    await this.redisClient.setex(key, totalTtlSeconds, JSON.stringify(entry));
  }
}
