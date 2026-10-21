import prisma from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export interface LogTapParams {
  traceId: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  ipAddress?: string | null
  userAgent?: string | null
  userId?: string | null
  userEmail?: string | null
  inputPayload?: any
  outputSummary?: any
  isError?: boolean
  errorMessage?: string | null
}

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "apikey",
  "api_key",
  "cookie",
  "credentials",
])

/**
 * Sanitize request/response payloads to protect privacy and security:
 * - Redacts passwords, tokens, API keys
 * - Masks base64 image strings and large binaries
 * - Masks 512-d vector embeddings
 * - Truncates excessively large texts to avoid DB bloat
 */
export function sanitizePayload(data: any, depth = 0): any {
  if (data === null || data === undefined) return null
  if (depth > 5) return "[Max Depth Reached]"

  if (typeof data === "string") {
    // Redact base64 images
    if (data.startsWith("data:image/") || data.startsWith("data:application/")) {
      return `[Embedded Media: ${data.slice(0, 30)}... total ${data.length} chars]`
    }
    // Truncate overly long strings
    if (data.length > 1000) {
      return `${data.slice(0, 1000)}... [truncated, total ${data.length} chars]`
    }
    return data
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data
  }

  if (Array.isArray(data)) {
    // Detect vector embeddings (e.g. 512 float numbers)
    if (data.length > 50 && typeof data[0] === "number") {
      return `[Vector Array: ${data.length} float numbers]`
    }
    return data.slice(0, 50).map((item) => sanitizePayload(item, depth + 1))
  }

  if (typeof data === "object") {
    const sanitized: Record<string, any> = {}
    for (const [key, val] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = "[REDACTED]"
      } else if (lowerKey.includes("embedding") || lowerKey === "faces" && Array.isArray(val)) {
        sanitized[key] = `[Facial Biometric Data Masked - count ${Array.isArray(val) ? val.length : 1}]`
      } else {
        sanitized[key] = sanitizePayload(val, depth + 1)
      }
    }
    return sanitized
  }

  return String(data)
}

/**
 * Generate a short unique correlation trace ID
 */
export function createTraceId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 8)
  return `tap_${timestamp}_${randomPart}`
}

/**
 * Extract Client IP and User Agent safely from NextRequest
 */
export function extractClientInfo(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || null
  const userAgent = req.headers.get("user-agent") || null
  return { ip, userAgent }
}

/**
 * Record a Log TAP entry asynchronously and fail-safely without blocking or throwing.
 */
export async function recordLogTap(params: LogTapParams): Promise<void> {
  try {
    const inputString = params.inputPayload !== undefined && params.inputPayload !== null
      ? typeof params.inputPayload === "string"
        ? params.inputPayload
        : JSON.stringify(sanitizePayload(params.inputPayload))
      : null

    const outputString = params.outputSummary !== undefined && params.outputSummary !== null
      ? typeof params.outputSummary === "string"
        ? params.outputSummary
        : JSON.stringify(sanitizePayload(params.outputSummary))
      : null

    await (prisma as any).logTap.create({
      data: {
        traceId: params.traceId,
        method: params.method.toUpperCase(),
        path: params.path,
        statusCode: params.statusCode,
        durationMs: Math.max(0, Math.round(params.durationMs)),
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        inputPayload: inputString,
        outputSummary: outputString,
        isError: params.isError ?? (params.statusCode >= 400),
        errorMessage: params.errorMessage || null,
      },
    })
  } catch (error) {
    // Fail safe: fall back to minimal logging without throwing
    console.error("[LogTap] Failed to write log tap:", error)
  }
}

/**
 * Higher-order wrapper to automatically TAP and track errors for any API route handler
 */
export function withLogTap(
  route: string,
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now()
    const traceId = createTraceId()
    const { ip, userAgent } = extractClientInfo(req)
    let requestBody: any = null

    // Clone and peek at JSON body if available
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      try {
        const cloned = req.clone()
        requestBody = await cloned.json().catch(() => null)
      } catch {
        // Not a JSON body (e.g. multipart/form-data or binary)
      }
    }

    try {
      const response = await handler(req, context)
      const durationMs = Date.now() - startTime

      // Attach x-trace-id to outgoing response headers
      response.headers.set("x-trace-id", traceId)

      // Record TAP asynchronously
      recordLogTap({
        traceId,
        method: req.method,
        path: route || req.nextUrl?.pathname || req.url,
        statusCode: response.status,
        durationMs,
        ipAddress: ip,
        userAgent,
        inputPayload: requestBody,
        isError: response.status >= 400,
      })

      return response
    } catch (error: any) {
      const durationMs = Date.now() - startTime
      console.error(`[withLogTap Error] ${req.method} ${route}:`, error)

      // Dynamically import trackError to avoid cyclic dependencies
      const { trackError } = await import("@/lib/error-tracker")
      await trackError({
        error,
        route,
        method: req.method,
        statusCode: 500,
        traceId,
        requestBody,
        ipAddress: ip,
      })

      await recordLogTap({
        traceId,
        method: req.method,
        path: route,
        statusCode: 500,
        durationMs,
        ipAddress: ip,
        userAgent,
        inputPayload: requestBody,
        isError: true,
        errorMessage: error?.message || "Internal Server Error",
      })

      const errResponse = NextResponse.json(
        { error: "Internal server error", traceId },
        { status: 500 }
      )
      errResponse.headers.set("x-trace-id", traceId)
      return errResponse
    }
  }
}
