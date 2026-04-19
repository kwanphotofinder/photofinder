import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

const DEFAULT_MIN_MATCH_CONFIDENCE = 0.6; // 60%

function getMinMatchConfidence(): number {
  const parsed = Number(process.env.MATCH_MIN_CONFIDENCE ?? DEFAULT_MIN_MATCH_CONFIDENCE);
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_MATCH_CONFIDENCE;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

export async function GET(req: NextRequest) {
  try {
    const minMatchConfidence = getMinMatchConfidence();
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
      ORDER BY f.embedding <=> $1::vector ASC
      LIMIT 20
    `, vectorString);

    // 3. Filter out duplicates by photo ID
    const uniqueResults = Array.from(
      new Map(rawResults.map(r => [r.id, r])).values()
    );

    const filteredResults = uniqueResults.filter((result) => result.confidence >= minMatchConfidence);
    const finalResults = filteredResults.slice(0, 10); // Standard limit

    return NextResponse.json({
      message: `Found ${finalResults.length} background matches (>= ${Math.round(minMatchConfidence * 100)}%)!`,
      results: finalResults,
    });

  } catch (error) {
    console.error('GET /api/me/matches error:', error);
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}
