import { NextRequest, NextResponse } from "next/server"
import { getObject } from "@/lib/storage"

export const runtime = "nodejs"

/**
 * Private photo proxy. MinIO is not reachable by browsers, so the app streams each
 * object's bytes through here. The stored `storageUrl` is `/api/photos/file/<key>`.
 *
 * NOTE: this is currently open (anyone with the path can load the image), matching the
 * previous Cloudinary behaviour. Per-viewer authorization is a planned follow-up.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params
  if (!key || !Array.isArray(key) || key.length === 0) {
    return new NextResponse("Bad request", { status: 400 })
  }

  // Path Traversal & Injection Protection
  const segmentPattern = /^[a-zA-Z0-9_\-\.]+$/
  for (const segment of key) {
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      segment.includes("..") ||
      segment.includes("\\") ||
      segment.includes("%2e") ||
      segment.includes("%2E") ||
      segment.includes("\0") ||
      !segmentPattern.test(segment)
    ) {
      return new NextResponse("Invalid path segment", { status: 400 })
    }
  }

  const objectKey = key.join("/")

  // Only allow access to supported storage prefixes
  if (!objectKey.startsWith("events/") && !objectKey.startsWith("faces/")) {
    return new NextResponse("Access denied: Invalid object prefix", { status: 403 })
  }

  let obj
  try {
    obj = await getObject(objectKey)
  } catch (err) {
    console.error(`[photo-proxy] failed to read ${objectKey}:`, err)
    return new NextResponse("Storage error", { status: 502 })
  }

  if (!obj) {
    return new NextResponse("Not found", { status: 404 })
  }

  return new NextResponse(new Uint8Array(obj.buffer), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType || "image/webp",
      "X-Content-Type-Options": "nosniff",
      // Photos are immutable at a given key; the blur flow busts cache with a ?v= suffix.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
