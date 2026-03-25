import { Redis } from '@upstash/redis'

// Initialize Redis with error handling
let redis: Redis | null = null

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    console.log('Redis connected successfully')
  } else {
    console.log('Redis not configured - running without cache')
  }
} catch (error) {
  console.error('Redis connection failed:', error)
  redis = null
}

// Cache keys
const CACHE_KEYS = {
  user: (userId: string) => `user:${userId}`,
  userPages: (userId: string) => `user:${userId}:pages`,
  lastPage: (userId: string) => `user:${userId}:last-page`,
  pageContent: (pageId: string) => `page:${pageId}:content`,
  socketRoom: (pageId: string) => `socket:room:${pageId}`,
} as const

// TTL constants (in seconds)
const TTL = {
  USER: 24 * 60 * 60, // 24 hours
  USER_PAGES: 5 * 60, // 5 minutes
  PAGE_CONTENT: 60 * 60, // 1 hour
  LAST_PAGE: 7 * 24 * 60 * 60, // 7 days
  SOCKET_ROOM: 30 * 60, // 30 minutes
} as const

export class RedisService {
  // User caching
  static async cacheUser(userId: string, userData: any) {
    if (!redis) return
    try {
      await redis.setex(CACHE_KEYS.user(userId), TTL.USER, JSON.stringify(userData))
    } catch (error) {
      console.error('Redis cacheUser error:', error)
    }
  }

  static async getUser(userId: string) {
    if (!redis) return null
    try {
      const data = await redis.get(CACHE_KEYS.user(userId))
      if (!data) return null
      
      if (typeof data === 'string') {
        return JSON.parse(data)
      } else if (typeof data === 'object') {
        return data
      } else {
        console.warn('Unexpected data type from Redis:', typeof data)
        return null
      }
    } catch (error) {
      console.error('Redis getUser error:', error)
      return null
    }
  }

  static async invalidateUser(userId: string) {
    if (!redis) return
    try {
      await redis.del(CACHE_KEYS.user(userId))
    } catch (error) {
      console.error('Redis invalidateUser error:', error)
    }
  }

  // User pages caching
  static async cacheUserPages(userId: string, pages: any[]) {
    if (!redis) return
    try {
      await redis.setex(CACHE_KEYS.userPages(userId), TTL.USER_PAGES, JSON.stringify(pages))
    } catch (error) {
      console.error('Redis cacheUserPages error:', error)
    }
  }

  static async getUserPages(userId: string) {
    if (!redis) return null
    try {
      const data = await redis.get(CACHE_KEYS.userPages(userId))
      if (!data) return null
      
      if (typeof data === 'string') {
        return JSON.parse(data)
      } else if (typeof data === 'object') {
        return data
      } else {
        console.warn('Unexpected data type from Redis:', typeof data)
        return null
      }
    } catch (error) {
      console.error('Redis getUserPages error:', error)
      return null
    }
  }

  // Last accessed page caching
  static async cacheLastPage(userId: string, pageData: any) {
    if (!redis) return
    try {
      await redis.setex(CACHE_KEYS.lastPage(userId), TTL.LAST_PAGE, JSON.stringify(pageData))
    } catch (error) {
      console.error('Redis cacheLastPage error:', error)
    }
  }

  static async getLastPage(userId: string) {
    if (!redis) return null
    try {
      const data = await redis.get(CACHE_KEYS.lastPage(userId))
      if (!data) return null
      
      // Handle different data types
      if (typeof data === 'string') {
        return JSON.parse(data)
      } else if (typeof data === 'object') {
        return data
      } else {
        console.warn('Unexpected data type from Redis:', typeof data)
        return null
      }
    } catch (error) {
      console.error('Redis getLastPage error:', error)
      return null
    }
  }

  // Page content caching
  static async cachePageContent(pageId: string, content: any) {
    if (!redis) return
    try {
      await redis.setex(CACHE_KEYS.pageContent(pageId), TTL.PAGE_CONTENT, JSON.stringify(content))
    } catch (error) {
      console.error('Redis cachePageContent error:', error)
    }
  }

  static async getPageContent(pageId: string) {
    if (!redis) return null
    try {
      const data = await redis.get(CACHE_KEYS.pageContent(pageId))
      if (!data) return null
      if (typeof data === 'string') {
        try {
          return JSON.parse(data)
        } catch (e) {
          console.error('Redis getPageContent parse error:', e)
          return null
        }
      } else if (typeof data === 'object') {
        return data
      } else {
        console.warn('Unexpected data type from Redis for pageContent:', typeof data)
        return null
      }
    } catch (error) {
      console.error('Redis getPageContent error:', error)
      return null
    }
  }

  static async invalidatePageContent(pageId: string) {
    if (!redis) return
    try {
      await redis.del(CACHE_KEYS.pageContent(pageId))
    } catch (error) {
      console.error('Redis invalidatePageContent error:', error)
    }
  }

  // Socket room caching
  static async cacheSocketRoom(pageId: string, roomData: any) {
    if (!redis) return
    try {
      await redis.setex(CACHE_KEYS.socketRoom(pageId), TTL.SOCKET_ROOM, JSON.stringify(roomData))
    } catch (error) {
      console.error('Redis cacheSocketRoom error:', error)
    }
  }

  static async getSocketRoom(pageId: string) {
    if (!redis) return null
    try {
      const data = await redis.get(CACHE_KEYS.socketRoom(pageId))
      return data ? JSON.parse(data as string) : null
    } catch (error) {
      console.error('Redis getSocketRoom error:', error)
      return null
    }
  }

  // Utility methods
  static async invalidateUserCache(userId: string) {
    if (!redis) return
    try {
      const keys = [
        CACHE_KEYS.user(userId),
        CACHE_KEYS.userPages(userId),
        CACHE_KEYS.lastPage(userId),
      ]
      await redis.del(...keys)
    } catch (error) {
      console.error('Redis invalidateUserCache error:', error)
    }
  }

  static async invalidatePageCache(pageId: string) {
    if (!redis) return
    try {
      await redis.del(CACHE_KEYS.pageContent(pageId))
    } catch (error) {
      console.error('Redis invalidatePageCache error:', error)
    }
  }
}

export default RedisService
