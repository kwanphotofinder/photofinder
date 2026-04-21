import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const MIN_MATCH_CONFIDENCE = 0.60; // 60% confidence required to protect privacy
    
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    }>>(`
      SELECT 
        f."photoId" as "id", 
        (1 - (f.embedding <=> $1::vector)) as "confidence",
        p."storageUrl" as "url",
        e."name" as "eventName",
        e."date" as "eventDate",
        p."createdAt" as "uploadDate"
      FROM "faces" f
      JOIN "photos" p ON f."photoId" = p."id"
      JOIN "events" e ON p."eventId" = e."id"
      WHERE (1 - (f.embedding <=> $1::vector)) >= $2
        AND e."status" = 'PUBLISHED'
      ORDER BY f.embedding <=> $1::vector ASC
      LIMIT 10
    `, vectorString, MIN_MATCH_CONFIDENCE);

    // 3. Filter out duplicates by photo ID
    const finalResults = Array.from(
      new Map(rawResults.map(r => [r.id, r])).values()
    );

    return NextResponse.json({
      message: `Found ${finalResults.length} background matches!`,
      results: finalResults,
    });

  } catch (error) {
    console.error('GET /api/me/matches error:', error);
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}
