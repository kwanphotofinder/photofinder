import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getPhotosEngagementBatch } from '@/lib/photo-engagement';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const thresholdQuery = searchParams.get('threshold') || searchParams.get('confidence');
    const requestedThreshold = thresholdQuery ? parseFloat(thresholdQuery) : NaN;
    // Default to 0.60, allow tuning from 0.35 (broad/more photos) to 0.95 (strict/precise)
    const matchConfidence = Number.isFinite(requestedThreshold)
      ? Math.max(0.35, Math.min(0.95, requestedThreshold))
      : 0.60;

    const limitParam = parseInt(searchParams.get('limit') || '60', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(10, limitParam)) : 60;
    
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.pdpaConsent) return NextResponse.json({ error: 'PDPA Consent required' }, { status: 403 });

    // 1. Check if they have a reference face
    // we use a raw query because we need to fetch the vector, which Prisma doesn't map natively by default
    const referenceFaceQuery = await prisma.$queryRawUnsafe<Array<{
      id: string;
      embedding_str: string;
    }>>(`
      SELECT id, embedding::text AS embedding_str 
      FROM "user_faces" 
      WHERE "userId" = $1
      LIMIT 1
    `, user.sub);

    if (referenceFaceQuery.length === 0) {
      return NextResponse.json({ error: 'No reference face found. Please upload a selfie first.' }, { status: 404 });
    }

    const vectorString = referenceFaceQuery[0].embedding_str;

    // 2. Search Postgres using pgvector's Cosine Distance (<=>)
    //    Filter by confidence threshold directly in SQL to avoid over-fetching,
    //    and only return photos from PUBLISHED events.
    const rawResults = await prisma.$queryRawUnsafe<Array<{
      id: string;
      confidence: number;
      url: string;
      eventName: string;
      eventDate: Date;
      uploadDate: Date;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
    }>>(`
      SELECT 
        f."photoId" as "id", 
        (1 - (f.embedding <=> $1::vector)) as "confidence",
        p."storageUrl" as "url",
        e."name" as "eventName",
        e."date" as "eventDate",
        p."createdAt" as "uploadDate",
        f.x, f.y, f.w, f.h
      FROM "faces" f
      JOIN "photos" p ON f."photoId" = p."id"
      JOIN "events" e ON p."eventId" = e."id"
      WHERE (1 - (f.embedding <=> $1::vector)) >= $2
        AND e."status" = 'PUBLISHED'
      ORDER BY f.embedding <=> $1::vector ASC
      LIMIT $3
    `, vectorString, matchConfidence, limit);

    // 3. Filter out duplicates by photo ID, keeping the one with highest confidence
    const photoMap = new Map<string, typeof rawResults[0]>();
    for (const item of rawResults) {
      const existing = photoMap.get(item.id);
      if (!existing || item.confidence > existing.confidence) {
        photoMap.set(item.id, item);
      }
    }
    const finalResults = Array.from(photoMap.values());

    // 4. Attach photo engagement stats (views, downloads, shares)
    const photoIds = finalResults.map((r) => r.id);
    const engagements = await getPhotosEngagementBatch(photoIds);
    const resultsWithEngagement = finalResults.map((r) => ({
      ...r,
      views: engagements[r.id]?.views ?? 0,
      downloads: engagements[r.id]?.downloads ?? 0,
      shares: engagements[r.id]?.shares ?? 0,
    }));

    return NextResponse.json({
      message: `Found ${resultsWithEngagement.length} background matches!`,
      threshold: matchConfidence,
      results: resultsWithEngagement,
    });

  } catch (error) {
    console.error('GET /api/me/matches error:', error);
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}
