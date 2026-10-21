import prisma from "../photofinder-nextjs/lib/prisma"
import { recordLogTap } from "../photofinder-nextjs/lib/log-tap"
import { trackError } from "../photofinder-nextjs/lib/error-tracker"
import { recordPhotoEngagement, getPhotoEngagementSummaries } from "../photofinder-nextjs/lib/photo-engagement"

async function runE2ETests() {
  console.log("==================================================")
  console.log("🚀 Starting Photo Finder End-to-End (E2E) Test Suite")
  console.log("==================================================\n")

  let passedTests = 0
  let totalTests = 0

  // Helper assertion
  function assert(condition: boolean, testName: string) {
    totalTests++
    if (condition) {
      console.log(`✅ [PASS] ${testName}`)
      passedTests++
    } else {
      console.error(`❌ [FAIL] ${testName}`)
    }
  }

  // TEST 1: Database Connection & pgvector
  console.log("--- 1. Testing Database & Extensions ---")
  try {
    const dbTest = await prisma.$queryRawUnsafe<any[]>("SELECT 1 as connected")
    assert(dbTest.length > 0 && dbTest[0].connected === 1, "PostgreSQL Database Connection")

    const extTest = await prisma.$queryRawUnsafe<any[]>(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'"
    )
    assert(extTest.length > 0 && extTest[0].extname === "vector", "pgvector Extension Active")
  } catch (err: any) {
    console.error("DB Error:", err.message)
    assert(false, "PostgreSQL Database Connection")
  }

  // TEST 2: AI Service Health
  console.log("\n--- 2. Testing AI Service Connectivity ---")
  try {
    const aiRes = await fetch("http://localhost:8000/")
    const aiData = await aiRes.json()
    assert(aiRes.ok && aiData.status === "ok", "AI Service (InsightFace) Health on port 8000")
  } catch (err: any) {
    console.error("AI Error:", err.message)
    assert(false, "AI Service Connectivity")
  }

  // TEST 3: Log TAP System (Decoupled Request Tracing)
  console.log("\n--- 3. Testing Log TAP Recording & Data Masking ---")
  try {
    const testTraceId = `e2e_tap_${Date.now()}`
    await recordLogTap({
      traceId: testTraceId,
      method: "POST",
      path: "/api/photos/test-upload/route",
      statusCode: 200,
      durationMs: 85,
      ipAddress: "127.0.0.1",
      userAgent: "E2E-Automated-Tester/1.0",
      userEmail: "test-student@lamduan.mfu.ac.th",
      inputPayload: {
        token: "secret_token_12345",
        password: "my_secret_password",
        base64Sample: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
        normalField: "Hello MFU",
      },
      outputSummary: { success: true, count: 1 },
    })

    // Retrieve from Database
    const tapLog = await (prisma as any).logTap.findFirst({
      where: { traceId: testTraceId },
    })

    assert(!!tapLog, "Log TAP record saved successfully to PostgreSQL")
    assert(tapLog?.statusCode === 200, "Log TAP status code recorded correctly")
    assert(tapLog?.durationMs === 85, "Log TAP latency recorded correctly")

    // Verify Data Masking
    const payload = JSON.parse(tapLog?.inputPayload || "{}")
    assert(payload.password === "[REDACTED]", "PDPA Masking: password was redacted")
    assert(payload.token === "[REDACTED]", "PDPA Masking: token was redacted")
    assert(payload.normalField === "Hello MFU", "Sanitization preserves non-sensitive fields")
  } catch (err: any) {
    console.error("Log TAP Error:", err.message)
    assert(false, "Log TAP System")
  }

  // TEST 4: Error Tracking & Deduplication (Fingerprinting)
  console.log("\n--- 4. Testing Error Tracking & Deduplication ---")
  try {
    const testRoute = `/api/test-e2e-route-${Date.now().toString(36)}`
    const errorMsg = "E2E Simulated AI Service Timeout"
    
    // First occurrence
    await trackError({
      error: new Error(errorMsg),
      route: testRoute,
      method: "POST",
      statusCode: 504,
      severity: "CRITICAL",
      userEmail: "tester@mfu.ac.th",
      ipAddress: "127.0.0.1",
    })

    const initialError = await (prisma as any).errorTrackLog.findFirst({
      where: { route: testRoute },
    })

    assert(!!initialError, "Error incident recorded in error_track_logs")
    assert(initialError?.status === "UNRESOLVED", "Initial error status is UNRESOLVED")
    assert(initialError?.occurrences === 1, "First occurrence count is 1")

    // Second occurrence (same error on same route)
    await trackError({
      error: new Error(errorMsg),
      route: testRoute,
      method: "POST",
      statusCode: 504,
      severity: "CRITICAL",
    })

    const updatedError = await (prisma as any).errorTrackLog.findFirst({
      where: { id: initialError.id },
    })

    assert(updatedError?.occurrences === 2, "Error Deduplication: occurrence count incremented to 2")
  } catch (err: any) {
    console.error("Error Tracking Test Error:", err.message)
    assert(false, "Error Tracking System")
  }

  // TEST 5: Photo Engagement Tracking (Views, Downloads, Shares)
  console.log("\n--- 5. Testing Photo Engagement Metrics ---")
  try {
    // Find or create dummy test photo
    let event = await prisma.event.findFirst()
    if (!event) {
      event = await prisma.event.create({
        data: {
          name: "MFU Commencement Ceremony 2026",
          slug: `mfu-commencement-${Date.now()}`,
          date: new Date(),
        },
      })
    }

    let photo = await prisma.photo.findFirst({ where: { eventId: event.id } })
    if (!photo) {
      photo = await prisma.photo.create({
        data: {
          eventId: event.id,
          storageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
          processingStatus: "COMPLETED",
        },
      })
    }

    // Record VIEW, DOWNLOAD, SHARE
    await recordPhotoEngagement({ photoId: photo.id, action: "VIEW", viewerId: "viewer_1" })
    await recordPhotoEngagement({ photoId: photo.id, action: "DOWNLOAD", viewerId: "viewer_1" })
    await recordPhotoEngagement({ photoId: photo.id, action: "SHARE", viewerId: "viewer_1" })

    const summaries = await getPhotoEngagementSummaries([photo.id])
    const stats = summaries instanceof Map ? summaries.get(photo.id) : (summaries as any)[photo.id]

    assert(!!stats, "Photo engagement summaries fetched successfully")
    assert((stats?.views ?? 0) >= 1, "View count incremented")
    assert((stats?.downloads ?? 0) >= 1, "Download count incremented")
    assert((stats?.shares ?? 0) >= 1, "Share count incremented")
  } catch (err: any) {
    console.error("Photo Engagement Error:", err.message)
    assert(false, "Photo Engagement Tracking")
  }

  // TEST 6: Match Confidence 50% Threshold Query
  console.log("\n--- 6. Testing Match Confidence SQL Filter (50% Locked) ---")
  try {
    const dummyVector = new Array(512).fill(0.01)
    const vectorString = `[${dummyVector.join(",")}]`

    const matchQuery = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        f."photoId" as "id", 
        (1 - (f.embedding <=> $1::vector)) as "confidence",
        p."storageUrl" as "url"
      FROM "faces" f
      JOIN "photos" p ON f."photoId" = p."id"
      JOIN "events" e ON p."eventId" = e."id"
      WHERE (1 - (f.embedding <=> $1::vector)) >= 0.50
      LIMIT 10
    `, vectorString)

    assert(Array.isArray(matchQuery), "Backend 50% Match Threshold Query executed successfully")
  } catch (err: any) {
    console.error("Match Threshold Query Error:", err.message)
    assert(false, "Match Confidence 50% Threshold Query")
  }

  console.log("\n==================================================")
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`)
  console.log("==================================================")

  await prisma.$disconnect()
}

runE2ETests().catch((err) => {
  console.error("Fatal test runner error:", err)
  process.exit(1)
})
