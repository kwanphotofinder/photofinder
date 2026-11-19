import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { uploadToCloudinary } from "@/lib/cloudinary"
import { optimizeForStorage } from "@/lib/image"
import { aiQueue } from "@/lib/ai-queue"
import { pushImportCompletionNotification } from "@/lib/line"
import { execFile } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs"

const execFileAsync = promisify(execFile)

export const maxDuration = 300 // 5 minutes timeout for downloading folder & uploading

export async function POST(req: NextRequest) {
  let tempDir: string | null = null
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (user.role !== "PHOTOGRAPHER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { eventId, driveUrl } = body

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }
    if (!driveUrl || typeof driveUrl !== "string") {
      return NextResponse.json({ error: "Google Drive folder URL is required" }, { status: 400 })
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true },
    })
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Locate python helper script
    let scriptPath = path.resolve(process.cwd(), "scripts/gdown_download_helper.py")
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.resolve(process.cwd(), "../scripts/gdown_download_helper.py")
    }

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: "Helper script gdown_download_helper.py not found on server" },
        { status: 500 }
      )
    }

    // Prepare temp directory
    tempDir = path.resolve(process.cwd(), ".temp_gdown", `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
    await fs.promises.mkdir(tempDir, { recursive: true })

    // Execute python script to download folder via gdown
    const pythonCmd = process.platform === "win32" ? "python" : "python3"
    let stdoutData = ""
    try {
      const { stdout } = await execFileAsync(pythonCmd, [scriptPath, driveUrl, "--output", tempDir], {
        timeout: 180000, // 3 minutes timeout for download
        maxBuffer: 10 * 1024 * 1024,
      })
      stdoutData = stdout
    } catch (execErr: any) {
      console.error("[gdown import] Exec error:", execErr)
      return NextResponse.json(
        {
          error: "Failed to download from Google Drive with gdown.",
          details: execErr.stderr || execErr.message || "Ensure folder is public and gdown is installed on the host.",
        },
        { status: 502 }
      )
    }

    // Parse output JSON
    let downloadResult: {
      success: boolean
      error?: string
      images?: Array<{ path: string; name: string; size: number }>
      imageCount?: number
    }
    try {
      downloadResult = JSON.parse(stdoutData.trim())
    } catch (parseErr) {
      console.error("[gdown import] Failed to parse output:", stdoutData)
      return NextResponse.json(
        { error: "Invalid response from gdown helper script", raw: stdoutData.slice(0, 500) },
        { status: 500 }
      )
    }

    if (!downloadResult.success || !downloadResult.images) {
      return NextResponse.json(
        { error: downloadResult.error || "Failed to download Google Drive folder" },
        { status: 400 }
      )
    }

    const { images } = downloadResult
    if (images.length === 0) {
      return NextResponse.json(
        {
          success: true,
          imported: 0,
          skipped: 0,
          total: 0,
          message: "No image files found in the specified Google Drive folder.",
        },
        { status: 200 }
      )
    }

    let importedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    // Process each image file
    for (const img of images) {
      try {
        if (!fs.existsSync(img.path)) continue

        const fileBuffer = await fs.promises.readFile(img.path)

        // 1. Optimize image for storage
        const optimized = await optimizeForStorage(fileBuffer)

        // 2. Duplicate detection
        const baseName = img.name.split(".")[0].replace(/[^a-zA-Z0-9_-]/g, "_")
        const existingPhoto = await prisma.photo.findFirst({
          where: {
            eventId,
            width: optimized.width,
            height: optimized.height,
            storageUrl: { contains: `/${baseName}_` },
          },
        })

        if (existingPhoto) {
          skippedCount++
          continue
        }

        // 3. Upload to Cloudinary
        const storageUrl = await uploadToCloudinary(img.name, "image/webp", optimized.buffer, eventId)

        // 4. Create Photo record in Prisma
        const photo = await prisma.photo.create({
          data: {
            eventId,
            uploaderId: user.sub,
            storageUrl,
            mimeType: "image/webp",
            processingStatus: "PENDING",
            width: optimized.width,
            height: optimized.height,
          },
        })

        // 5. Enqueue into background AI Processing Queue
        await aiQueue.enqueue(
          {
            photoId: photo.id,
            storageUrl: photo.storageUrl,
            imageBuffer: optimized.buffer,
            fileName: img.name,
          },
          "LOW"
        )

        importedCount++
      } catch (err: any) {
        console.error(`[gdown import] Error processing ${img.name}:`, err)
        errors.push(`${img.name}: ${err.message}`)
      }
    }

    // Send LINE Push Notification to photographer if connected
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.sub },
        select: { lineUserId: true },
      })
      if (dbUser?.lineUserId && importedCount > 0) {
        const actionUrl = `${process.env.APP_URL || "http://localhost:3000"}/photographer`
        await pushImportCompletionNotification(
          dbUser.lineUserId,
          event.name,
          importedCount,
          skippedCount,
          actionUrl
        )
      }
    } catch (lineErr) {
      console.warn("[gdown import] Could not send LINE notification:", lineErr)
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      total: images.length,
      errors: errors.slice(0, 5),
      message: `Successfully imported ${importedCount} photo(s) from Google Drive into '${event.name}' (${skippedCount} duplicates skipped). Face recognition running in background.`,
    })
  } catch (err: any) {
    console.error("[API import-drive] Unexpected error:", err)
    return NextResponse.json(
      { error: "Internal server error during Google Drive import", details: err.message },
      { status: 500 }
    )
  } finally {
    // Cleanup temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
      } catch (rmErr) {
        console.warn("[gdown import] Failed to remove temp directory:", rmErr)
      }
    }
  }
}
