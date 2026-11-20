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
  const objectKey = (key || []).join("/")
  if (!objectKey) {
    return new NextResponse("Bad request", { status: 400 })
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
      // Photos are immutable at a given key; the blur flow busts cache with a ?v= suffix.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
