import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3"

/**
 * Object storage backed by MinIO (S3-compatible), self-hosted on the university server.
 *
 * Photos are stored PRIVATELY in a single bucket and never served directly to browsers.
 * Each object's DB value ("storageUrl") is a relative proxy path — `/api/photos/file/<key>` —
 * and the app streams the bytes through `app/api/photos/file/[...key]` (see that route).
 *
 * Key layout inside the bucket:
 *   events/<eventId>/<file>   — event photos (bulk-deletable by event prefix)
 *   faces/<file>              — reference selfies / user faces (no event)
 */

const ENDPOINT = process.env.MINIO_ENDPOINT
const BUCKET = process.env.MINIO_BUCKET || "photofinder"
const REGION = process.env.MINIO_REGION || "us-east-1"
const PROXY_PREFIX = "/api/photos/file/"

let _client: S3Client | null = null

function client(): S3Client {
  if (!ENDPOINT) {
    throw new Error("MINIO_ENDPOINT environment variable is missing.")
  }
  if (!_client) {
    _client = new S3Client({
      endpoint: ENDPOINT,
      region: REGION,
      forcePathStyle: true, // MinIO uses path-style addressing (bucket in the path, not the host)
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || "",
        secretAccessKey: process.env.MINIO_SECRET_KEY || "",
      },
    })
  }
  return _client
}

function sanitizeBase(fileName: string): string {
  const stem = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName
  return stem.replace(/[^a-zA-Z0-9_-]/g, "_") || "file"
}

function extFor(fileName: string, mimeType: string): string {
  if (mimeType === "image/webp") return "webp"
  if (mimeType === "image/jpeg") return "jpg"
  if (mimeType === "image/png") return "png"
  const i = fileName.lastIndexOf(".")
  return i !== -1 ? fileName.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "webp" : "webp"
}

/** Build the relative proxy URL stored in the DB for a given object key. */
export function urlForKey(key: string): string {
  return PROXY_PREFIX + key.split("/").map(encodeURIComponent).join("/")
}

/** Recover the object key from a stored proxy URL (ignores any ?query cache-buster). */
export function keyFromUrl(url: string): string | null {
  if (!url) return null
  const i = url.indexOf(PROXY_PREFIX)
  if (i === -1) return null
  const after = url.slice(i + PROXY_PREFIX.length).split("?")[0]
  return decodeURIComponent(after)
}

/**
 * Uploads a buffer and returns the relative proxy URL to store in the DB.
 * Same signature as the former Cloudinary helper so call sites stay thin.
 */
export async function uploadToStorage(
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer,
  eventId?: string,
): Promise<string> {
  const key = buildKey(fileName, mimeType, eventId)
  await client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: fileBuffer, ContentType: mimeType }),
  )
  return urlForKey(key)
}

function buildKey(fileName: string, mimeType: string, eventId?: string): string {
  const name = `${sanitizeBase(fileName)}_${Date.now()}.${extFor(fileName, mimeType)}`
  return eventId ? `events/${eventId}/${name}` : `faces/${name}`
}

/** Overwrite the object at an existing key (used by the blur flow). */
export async function putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }),
  )
}

/** Fetch an object's bytes + content type, or null if it doesn't exist. */
export async function getObject(
  key: string,
): Promise<{ buffer: Buffer; contentType?: string } | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const bytes = await res.Body!.transformToByteArray()
    return { buffer: Buffer.from(bytes), contentType: res.ContentType }
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) return null
    throw err
  }
}

/** Fetch just the bytes (throws if missing). Used by the AI queue recovery path. */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const obj = await getObject(key)
  if (!obj) throw new Error(`Object not found in storage: ${key}`)
  return obj.buffer
}

/** Delete a single object given its stored proxy URL. Fail-safe (never throws). */
export async function deleteFromStorage(url: string): Promise<void> {
  const key = keyFromUrl(url)
  if (!key) return
  try {
    await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch (err) {
    console.error(`Error deleting ${key} from storage:`, err)
  }
}

/** Delete every object for an event (the `events/<eventId>/` prefix). Fail-safe. */
export async function deleteFolderFromStorage(eventId: string): Promise<void> {
  if (!eventId) return
  const prefix = `events/${eventId}/`
  try {
    let ContinuationToken: string | undefined
    do {
      const list = await client().send(
        new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken }),
      )
      const objects = (list.Contents || []).map((o) => ({ Key: o.Key! }))
      if (objects.length > 0) {
        await client().send(
          new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects, Quiet: true } }),
        )
      }
      ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined
    } while (ContinuationToken)
    console.log(`Deleted storage folder: ${prefix}`)
  } catch (err) {
    console.error(`Error deleting storage folder ${eventId}:`, err)
  }
}
