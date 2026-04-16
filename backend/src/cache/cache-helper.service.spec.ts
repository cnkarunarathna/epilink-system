/// <reference types="jest" />
import { CacheHelperService } from './cache-helper.service';

describe('CacheHelperService', () => {
  const createCacheManager = (overrides?: Partial<any>) => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    store: undefined,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should read and parse JSON from redis client when available', async () => {
    const redisClient = {
      get: jest.fn().mockResolvedValue('{"value":123}'),
    };
    const cacheManager = createCacheManager({
      store: { getClient: jest.fn().mockReturnValue(redisClient) },
    });
    const service = new CacheHelperService(cacheManager as any);

    const value = await service.get<{ value: number }>('k1');

    expect(value).toEqual({ value: 123 });
    expect(redisClient.get).toHaveBeenCalledWith('k1');
  });

  it('should return null for invalid redis JSON payloads', async () => {
    const redisClient = {
      get: jest.fn().mockResolvedValue('not-json'),
    };
    const cacheManager = createCacheManager({
      store: { getClient: jest.fn().mockReturnValue(redisClient) },
    });
    const service = new CacheHelperService(cacheManager as any);

    await expect(service.get('k1')).resolves.toBeNull();
  });

  it('should use setex with rounded-up ttl seconds in redis mode', async () => {
    const redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
    };
    const cacheManager = createCacheManager({
      store: { getClient: jest.fn().mockReturnValue(redisClient) },
    });
    const service = new CacheHelperService(cacheManager as any);

    await service.set('k2', { a: 1 }, 1500);

    expect(redisClient.setex).toHaveBeenCalledWith('k2', 2, '{"a":1}');
  });

  it('should increment counter atomically via redis pipeline', async () => {
    const pipeline = {
      incr: jest.fn().mockReturnThis(),
      pexpire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 3],
        [null, 1],
      ]),
    };
    const redisClient = {
      pipeline: jest.fn().mockReturnValue(pipeline),
    };
    const cacheManager = createCacheManager({
      store: { getClient: jest.fn().mockReturnValue(redisClient) },
    });
    const service = new CacheHelperService(cacheManager as any);

    const value = await service.incr('counter', 30_000);

    expect(value).toBe(3);
    expect(pipeline.incr).toHaveBeenCalledWith('counter');
    expect(pipeline.pexpire).toHaveBeenCalledWith('counter', 30_000);
  });

  it('should delete keys by pattern and ignore redis errors', async () => {
    const redisClient = {
      keys: jest.fn().mockResolvedValue(['tasks:1', 'tasks:2']),
      del: jest.fn().mockResolvedValue(2),
    };
    const cacheManager = createCacheManager({
      store: { getClient: jest.fn().mockReturnValue(redisClient) },
    });
    const service = new CacheHelperService(cacheManager as any);

    await service.delByPattern('tasks:*');

    expect(redisClient.keys).toHaveBeenCalledWith('tasks:*');
    expect(redisClient.del).toHaveBeenCalledWith('tasks:1', 'tasks:2');

    redisClient.keys.mockRejectedValueOnce(new Error('redis down'));

    await expect(service.delByPattern('tasks:*')).resolves.toBeUndefined();
  });

  it('should return fresh SWR redis data without invoking fetcher', async () => {
    const entry = {
      __swr__: true,
      data: { value: 'cached' },
      freshUntil: Date.now() + 10_000,
    };
    const redisClient = {
      get: jest.fn().mockResolvedValue(JSON.stringify(entry)),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };
    const cacheManager = createCacheManager({
      store: { getClient: jest.fn().mockReturnValue(redisClient) },
    });
    const service = new CacheHelperService(cacheManager as any);
    const fetcher = jest.fn();

    const value = await service.getOrRefresh('swr:key', 5_000, fetcher);

    expect(value).toEqual({ value: 'cached' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('should return stale data and attempt background refresh lock', async () => {
    const entry = {
      __swr__: true,
      data: { value: 'stale' },
      freshUntil: Date.now() - 100,
    };
    const redisClient = {
      get: jest.fn().mockResolvedValue(JSON.stringify(entry)),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn(),
      setex: jest.fn(),
    };
    const cacheManager = createCacheManager({
      store: { getClient: jest.fn().mockReturnValue(redisClient) },
    });
    const service = new CacheHelperService(cacheManager as any);
    const fetcher = jest.fn().mockResolvedValue({ value: 'fresh' });

    const value = await service.getOrRefresh('swr:key', 5_000, fetcher);

    expect(value).toEqual({ value: 'stale' });
    expect(redisClient.set).toHaveBeenCalledWith(
      'swr:key:refresh_lock',
      '1',
      'EX',
      expect.any(Number),
      'NX',
    );
  });

  it('should fetch and store SWR entry on redis hard miss', async () => {
    const redisClient = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    const cacheManager = createCacheManager({
      store: { getClient: jest.fn().mockReturnValue(redisClient) },
    });
    const service = new CacheHelperService(cacheManager as any);
    const fetcher = jest.fn().mockResolvedValue({ value: 77 });

    const value = await service.getOrRefresh(
      'hard:miss',
      3_000,
      fetcher,
      2_000,
    );

    expect(value).toEqual({ value: 77 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(redisClient.setex).toHaveBeenCalledWith(
      'hard:miss',
      5,
      expect.stringContaining('"__swr__":true'),
    );
  });

  it('should use cache-manager fallback path when redis client is unavailable', async () => {
    const cacheManager = createCacheManager();
    const service = new CacheHelperService(cacheManager as any);
    const fetcher = jest.fn().mockResolvedValue({ value: 9 });

    cacheManager.get.mockResolvedValueOnce({ value: 8 });
    const cached = await service.getOrRefresh('fallback', 10_000, fetcher);
    expect(cached).toEqual({ value: 8 });
    expect(fetcher).not.toHaveBeenCalled();

    cacheManager.get.mockResolvedValueOnce(null);
    const fetched = await service.getOrRefresh('fallback', 10_000, fetcher);
    expect(fetched).toEqual({ value: 9 });
    expect(cacheManager.set).toHaveBeenCalledWith(
      'fallback',
      { value: 9 },
      10_000,
    );
  });
});
