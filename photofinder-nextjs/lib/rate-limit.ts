import { NextRequest, NextResponse } from "next/server"

export interface RateLimitConfig {
  limit: number      // Max requests allowed in window
  windowMs: number   // Window size in milliseconds
  name?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfterSeconds: number
}

// Preset limits designed for campus scale & protection
export const RATE_LIMIT_TIERS = {
  // Heavy AI GPU/CPU endpoints: Face matching, liveness, embedding extraction
  AI_SEARCH: { limit: 15, windowMs: 60 * 1000, name: "AI Search" },
  
  // Media upload endpoints: Cloudinary storage & worker queue
  UPLOAD: { limit: 30, windowMs: 60 * 1000, name: "Photo Upload" },

  // Auth endpoints: Prevent credential stuffing & token abuse
  AUTH: { limit: 15, windowMs: 60 * 1000, name: "Auth" },

  // General read APIs: Listing events, viewing public albums
  GENERAL: { limit: 120, windowMs: 60 * 1000, name: "General API" },
} as const

interface Bucket {
  count: number
  resetTime: number
}

// In-memory store (per process)
class MemoryRateLimiter {
  private store = new Map<string, Bucket>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Run cleanup every 60 seconds to prune expired buckets and prevent memory leaks
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000)
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref()
      }
    }
  }

  public check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now()
    const bucket = this.store.get(key)

    if (!bucket || now >= bucket.resetTime) {
      // First hit or window expired
      const resetTime = now + windowMs
      this.store.set(key, { count: 1, resetTime })
      return {
        success: true,
        limit,
        remaining: Math.max(0, limit - 1),
        resetTime,
        retryAfterSeconds: 0,
      }
    }

    // Inside window
    bucket.count += 1
    const remaining = Math.max(0, limit - bucket.count)
    const success = bucket.count <= limit
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetTime - now) / 1000))

    return {
      success,
      limit,
      remaining,
      resetTime: bucket.resetTime,
      retryAfterSeconds: success ? 0 : retryAfterSeconds,
    }
  }

  public cleanup() {
    const now = Date.now()
    for (const [key, bucket] of this.store.entries()) {
      if (now >= bucket.resetTime) {
        this.store.delete(key)
      }
    }
  }

  public reset(key?: string) {
    if (key) {
      this.store.delete(key)
    } else {
      this.store.clear()
    }
  }
}

// Global Singleton to survive hot-reloads in development
const globalForLimiter = globalThis as unknown as { rateLimiter?: MemoryRateLimiter }
export const memoryRateLimiter = globalForLimiter.rateLimiter ?? new MemoryRateLimiter()
if (process.env.NODE_ENV !== "production") globalForLimiter.rateLimiter = memoryRateLimiter

/**
 * Extract a distinct client identifier:
 * 1. Bearer Token hash / sub if available (so students on shared campus Wi-Fi NAT don't starve each other)
 * 2. Client IP from 'x-forwarded-for' or 'x-real-ip'
 */
export function getClientIdentifier(req: NextRequest): string {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim()
    if (token) {
      // Use token suffix as identifier
      return `auth_${token.slice(-16)}`
    }
  }

  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const clientIp = forwarded.split(",")[0].trim()
    if (clientIp) return `ip_${clientIp}`
  }

  const realIp = req.headers.get("x-real-ip")
  if (realIp) return `ip_${realIp}`

  return "ip_127.0.0.1"
}

/**
 * Check rate limit for a request against a specified tier or custom config
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  customIdentifier?: string
): RateLimitResult {
  const id = customIdentifier || getClientIdentifier(req)
  const key = `${config.name || "api"}:${id}`
  return memoryRateLimiter.check(key, config.limit, config.windowMs)
}

/**
 * Generate standard HTTP RateLimit headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
  }

  if (!result.success) {
    headers["Retry-After"] = String(result.retryAfterSeconds)
  }

  return headers
}

/**
 * Create a standard 429 Too Many Requests response
 */
export function createRateLimitExceededResponse(
  result: RateLimitResult,
  tierName?: string
): NextResponse {
  const message = tierName
    ? `Too many requests for ${tierName}. Please wait ${result.retryAfterSeconds} seconds before retrying.`
    : `Too many requests. Please wait ${result.retryAfterSeconds} seconds before retrying.`

  return NextResponse.json(
    {
      error: "Too Many Requests",
      message,
      retryAfter: result.retryAfterSeconds,
      limit: result.limit,
      remaining: 0,
    },
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...getRateLimitHeaders(result),
      },
    }
  )
}
