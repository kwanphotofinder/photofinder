import prisma from "@/lib/prisma"
import { sanitizePayload } from "@/lib/log-tap"
import crypto from "crypto"

export interface ErrorTrackingParams {
  error: Error | any
  route: string
  method?: string
  statusCode?: number
  severity?: "CRITICAL" | "ERROR" | "WARNING"
  traceId?: string | null
  requestBody?: any
  queryParams?: Record<string, string> | string | null
  userEmail?: string | null
  ipAddress?: string | null
}

/**
 * Generate a deterministic fingerprint for grouping identical errors together
 */
export function generateFingerprint(errorName: string, route: string, message: string): string {
  // Normalize message (remove UUIDs, IDs, numbers so similar errors group together)
  const normalizedMsg = message
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, ":id")
    .replace(/\d+/g, ":num")
    .trim()
    .slice(0, 150)

  const raw = `${errorName}:${route}:${normalizedMsg}`
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32)
}

/**
 * Track an error asynchronously and fail-safely.
 * Deduplicates recurring errors by incrementing the occurrence count and updating lastSeenAt.
 */
export async function trackError(params: ErrorTrackingParams): Promise<void> {
  try {
    const error = params.error
    const errorName = error?.name || (typeof error === "string" ? "CustomError" : "UnhandledError")
    const message = error?.message || (typeof error === "string" ? error : JSON.stringify(error) || "Unknown error")
    const stack = error?.stack || null
    const route = params.route || "UNKNOWN_ROUTE"
    const method = (params.method || "UNKNOWN").toUpperCase()
    const statusCode = params.statusCode || 500
    const severity = params.severity || (statusCode >= 500 ? "CRITICAL" : "ERROR")

    const fingerprint = generateFingerprint(errorName, route, message)

    const sanitizedBody = params.requestBody !== undefined && params.requestBody !== null
      ? typeof params.requestBody === "string"
        ? params.requestBody
        : JSON.stringify(sanitizePayload(params.requestBody))
      : null

    const sanitizedQueryParams = params.queryParams !== undefined && params.queryParams !== null
      ? typeof params.queryParams === "string"
        ? params.queryParams
        : JSON.stringify(params.queryParams)
      : null

    // Look for existing unresolved error incident with the same fingerprint
    const existing = await (prisma as any).errorTrackLog.findFirst({
      where: {
        fingerprint,
        status: { in: ["UNRESOLVED", "INVESTIGATING"] },
      },
    })

    if (existing) {
      await (prisma as any).errorTrackLog.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          lastSeenAt: new Date(),
          // Update latest request context for reproduction
          traceId: params.traceId || existing.traceId,
          requestBody: sanitizedBody || existing.requestBody,
          queryParams: sanitizedQueryParams || existing.queryParams,
          userEmail: params.userEmail || existing.userEmail,
          ipAddress: params.ipAddress || existing.ipAddress,
        },
      })
    } else {
      await (prisma as any).errorTrackLog.create({
        data: {
          fingerprint,
          errorName,
          message,
          stack,
          severity,
          route,
          method,
          statusCode,
          traceId: params.traceId || null,
          requestBody: sanitizedBody,
          queryParams: sanitizedQueryParams,
          userEmail: params.userEmail || null,
          ipAddress: params.ipAddress || null,
          status: "UNRESOLVED",
          occurrences: 1,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      })
    }
  } catch (err) {
    console.error("[ErrorTracker] Failed to record error track log:", err)
  }
}

/**
 * Generate a cURL command for developers/admins to easily reproduce the error locally
 */
export function generateCurlReproduction(
  baseUrl: string,
  route: string,
  method: string,
  queryParams: string | null,
  requestBody: string | null
): string {
  let fullUrl = `${baseUrl.replace(/\/$/, "")}${route}`
  if (queryParams) {
    try {
      const parsed = JSON.parse(queryParams)
      const q = new URLSearchParams(parsed).toString()
      if (q) fullUrl += `?${q}`
    } catch {
      if (queryParams.startsWith("?")) fullUrl += queryParams
      else fullUrl += `?${queryParams}`
    }
  }

  let curl = `curl -X ${method.toUpperCase()} "${fullUrl}" \\\n  -H "Content-Type: application/json"`

  if (requestBody && requestBody !== "null" && requestBody !== "{}") {
    // Escape single quotes for bash
    const escaped = requestBody.replace(/'/g, "'\\''")
    curl += ` \\\n  -d '${escaped}'`
  }

  return curl
}
