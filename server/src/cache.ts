import { CachedData } from './types';
import { logger } from './logger';

interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

class Cache {
  private store = new Map<string, CacheItem<any>>();
  private defaultTTL: number;

  constructor(ttlSeconds: number = 300) {
    this.defaultTTL = ttlSeconds * 1000;
  }

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      logger.debug(`Cache expired for key: ${key}`);
      return null;
    }
    logger.debug(`Cache hit for key: ${key}`);
    return item.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    const expiresAt = Date.now() + ttl;
    this.store.set(key, { data, expiresAt });
    logger.debug(`Cache set for key: ${key}, expires in ${ttl / 1000}s`);
  }

  clear(): void {
    this.store.clear();
    logger.info('Cache cleared');
  }
}

export const cache = new Cache(parseInt(process.env.CACHE_TTL || '300', 10));