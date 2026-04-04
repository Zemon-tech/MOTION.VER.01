import Redis from "ioredis";

let redis: Redis | null = null;

const redisUrl =
  process.env.UPSTASH_REDIS_URL ||
  process.env.REDIS_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  redis.on("connect", () => {
    console.log("Redis connected successfully");
  });

  redis.on("error", (error) => {
    console.error("Redis connection error:", error);
  });
} else {
  console.log("Redis not configured - running without cache");
}

// Cache keys
const CACHE_KEYS = {
  user: (userId: string) => `user:${userId}`,
  userPages: (userId: string) => `user:${userId}:pages`,
  lastPage: (userId: string) => `user:${userId}:last-page`,
  pageContent: (pageId: string) => pageId,
  pageSlug: (slug: string) => `slug:${slug}`,
  socketRoom: (pageId: string) => `socket:room:${pageId}`,
} as const;

// TTL constants (in seconds)
const TTL = {
  USER: 24 * 60 * 60, // 24 hours
  USER_PAGES: 5 * 60, // 5 minutes
  PAGE_CONTENT: 60 * 60, // 1 hour
  PAGE_SLUG: 60 * 60, // 1 hour
  LAST_PAGE: 7 * 24 * 60 * 60, // 7 days
  SOCKET_ROOM: 30 * 60, // 30 minutes
} as const;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
  windowMs: number;
};

export class RedisService {
  private static parse<T = unknown>(data: string | null): T | null {
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      console.error("Redis parse error:", error);
      return null;
    }
  }

  // User caching
  static async cacheUser(userId: string, userData: any) {
    if (!redis) return;
    try {
      await redis.setex(
        CACHE_KEYS.user(userId),
        TTL.USER,
        JSON.stringify(userData),
      );
    } catch (error) {
      console.error("Redis cacheUser error:", error);
    }
  }

  static async getUser(userId: string) {
    if (!redis) return null;
    try {
      const data = await redis.get(CACHE_KEYS.user(userId));
      return RedisService.parse(data);
    } catch (error) {
      console.error("Redis getUser error:", error);
      return null;
    }
  }

  static async invalidateUser(userId: string) {
    if (!redis) return;
    try {
      await redis.del(CACHE_KEYS.user(userId));
    } catch (error) {
      console.error("Redis invalidateUser error:", error);
    }
  }

  // User pages caching
  static async cacheUserPages(userId: string, pages: any[]) {
    if (!redis) return;
    try {
      await redis.setex(
        CACHE_KEYS.userPages(userId),
        TTL.USER_PAGES,
        JSON.stringify(pages),
      );
    } catch (error) {
      console.error("Redis cacheUserPages error:", error);
    }
  }

  static async getUserPages(userId: string) {
    if (!redis) return null;
    try {
      const data = await redis.get(CACHE_KEYS.userPages(userId));
      return RedisService.parse(data);
    } catch (error) {
      console.error("Redis getUserPages error:", error);
      return null;
    }
  }

  // Last accessed page caching
  static async cacheLastPage(userId: string, pageData: any) {
    if (!redis) return;
    try {
      await redis.setex(
        CACHE_KEYS.lastPage(userId),
        TTL.LAST_PAGE,
        JSON.stringify(pageData),
      );
    } catch (error) {
      console.error("Redis cacheLastPage error:", error);
    }
  }

  static async getLastPage(userId: string) {
    if (!redis) return null;
    try {
      const data = await redis.get(CACHE_KEYS.lastPage(userId));
      return RedisService.parse(data);
    } catch (error) {
      console.error("Redis getLastPage error:", error);
      return null;
    }
  }

  // Page content caching
  static async cachePageContent(pageId: string, content: any) {
    if (!redis) return;
    try {
      await redis.setex(
        CACHE_KEYS.pageContent(pageId),
        TTL.PAGE_CONTENT,
        JSON.stringify(content),
      );
    } catch (error) {
      console.error("Redis cachePageContent error:", error);
    }
  }

  static async getPageContent(pageId: string) {
    if (!redis) return null;
    try {
      const data = await redis.get(CACHE_KEYS.pageContent(pageId));
      return RedisService.parse(data);
    } catch (error) {
      console.error("Redis getPageContent error:", error);
      return null;
    }
  }

  static async cachePageSlug(slug: string, pageId: string) {
    if (!redis) return;
    try {
      await redis.setex(CACHE_KEYS.pageSlug(slug), TTL.PAGE_SLUG, pageId);
    } catch (error) {
      console.error("Redis cachePageSlug error:", error);
    }
  }

  static async getPageIdBySlug(slug: string) {
    if (!redis) return null;
    try {
      return await redis.get(CACHE_KEYS.pageSlug(slug));
    } catch (error) {
      console.error("Redis getPageIdBySlug error:", error);
      return null;
    }
  }

  static async invalidatePageSlug(slug: string) {
    if (!redis) return;
    try {
      await redis.del(CACHE_KEYS.pageSlug(slug));
    } catch (error) {
      console.error("Redis invalidatePageSlug error:", error);
    }
  }

  static async invalidatePageContent(pageId: string) {
    if (!redis) return;
    try {
      await redis.del(CACHE_KEYS.pageContent(pageId));
    } catch (error) {
      console.error("Redis invalidatePageContent error:", error);
    }
  }

  // Socket room caching
  static async cacheSocketRoom(pageId: string, roomData: any) {
    if (!redis) return;
    try {
      await redis.setex(
        CACHE_KEYS.socketRoom(pageId),
        TTL.SOCKET_ROOM,
        JSON.stringify(roomData),
      );
    } catch (error) {
      console.error("Redis cacheSocketRoom error:", error);
    }
  }

  static async getSocketRoom(pageId: string) {
    if (!redis) return null;
    try {
      const data = await redis.get(CACHE_KEYS.socketRoom(pageId));
      return RedisService.parse(data);
    } catch (error) {
      console.error("Redis getSocketRoom error:", error);
      return null;
    }
  }

  // Utility methods
  static async invalidateUserCache(userId: string) {
    if (!redis) return;
    try {
      const keys = [
        CACHE_KEYS.user(userId),
        CACHE_KEYS.userPages(userId),
        CACHE_KEYS.lastPage(userId),
      ];
      await redis.del(...keys);
    } catch (error) {
      console.error("Redis invalidateUserCache error:", error);
    }
  }

  static async invalidatePageCache(pageId: string) {
    if (!redis) return;
    try {
      await redis.del(CACHE_KEYS.pageContent(pageId));
    } catch (error) {
      console.error("Redis invalidatePageCache error:", error);
    }
  }

  static async cachePage(page: { _id: unknown; slug?: string | null }) {
    if (!redis) return;
    try {
      const pageId = String(page._id);
      await redis.setex(
        CACHE_KEYS.pageContent(pageId),
        TTL.PAGE_CONTENT,
        JSON.stringify(page),
      );
      if (page.slug) {
        await redis.setex(
          CACHE_KEYS.pageSlug(page.slug),
          TTL.PAGE_SLUG,
          pageId,
        );
      }
    } catch (error) {
      console.error("Redis cachePage error:", error);
    }
  }

  static async consumePageCreateQuota(
    userId: string,
    opts?: { limit?: number; windowMs?: number },
  ): Promise<RateLimitResult> {
    const limit = opts?.limit ?? 3;
    const windowMs = opts?.windowMs ?? 60_000;

    if (!redis) {
      return {
        allowed: true,
        remaining: limit - 1,
        retryAfterMs: 0,
        limit,
        windowMs,
      };
    }

    const key = `rate_limit:user:${userId}:page_create`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }

      let ttlMs = await redis.pttl(key);
      if (ttlMs <= 0) {
        await redis.pexpire(key, windowMs);
        ttlMs = windowMs;
      }

      const retryAfterMs = Math.max(0, ttlMs);
      const remaining = Math.max(0, limit - count);
      const allowed = count <= limit;

      return {
        allowed,
        remaining,
        retryAfterMs: allowed ? 0 : retryAfterMs,
        limit,
        windowMs,
      };
    } catch (error) {
      console.error("Redis consumePageCreateQuota error:", error);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: windowMs,
        limit,
        windowMs,
      };
    }
  }
}

export default RedisService;
