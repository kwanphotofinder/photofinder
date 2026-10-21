import { NextRequest, NextResponse } from "next/server"
import {
  checkRateLimit,
  createRateLimitExceededResponse,
  getRateLimitHeaders,
  RATE_LIMIT_TIERS,
} from "./lib/rate-limit"

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Only apply rate limiting to API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  // Determine rate limit tier based on the API route sensitivity
  let tier = RATE_LIMIT_TIERS.GENERAL

  if (
    pathname.startsWith("/api/verify-identity") ||
    pathname.startsWith("/api/student/liveness-detect") ||
    pathname.startsWith("/api/me/reference-face") ||
    pathname.startsWith("/api/me/matches")
  ) {
    tier = RATE_LIMIT_TIERS.AI_SEARCH
  } else if (
    pathname.startsWith("/api/photos/upload") ||
    (pathname.startsWith("/api/events") && pathname.endsWith("/upload")) ||
    pathname.includes("/retry")
  ) {
    tier = RATE_LIMIT_TIERS.UPLOAD
  } else if (pathname.startsWith("/api/auth")) {
    tier = RATE_LIMIT_TIERS.AUTH
  }

  const result = checkRateLimit(req, tier)

  if (!result.success) {
    return createRateLimitExceededResponse(result, tier.name)
  }

  // Continue request and attach RateLimit headers to response
  const response = NextResponse.next()
  const headers = getRateLimitHeaders(result)
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }

  return response
}

export const config = {
  matcher: [
    // Match all /api routes
    "/api/:path*",
  ],
}
