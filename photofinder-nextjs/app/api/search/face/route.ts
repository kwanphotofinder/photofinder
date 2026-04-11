import { NextRequest, NextResponse } from 'next/server';
import { extractFaces } from '@/lib/ai';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const maxDuration = 180; // Allow AI to wake up

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 1. Get embedding from AI Service
    const faces = await extractFaces(fileBuffer, file.name);

    if (!faces || faces.length === 0) {
      return NextResponse.json({ message: 'No face detected', results: [] });
    }

    // 2. We use the first detected face for searching
    const vector = faces[0].embedding;
    const vectorString = `[${vector.join(',')}]`;

    // 3. Search Postgres using pgvector's Cosine Distance (<=>)
    // We fetch the top 20 nearest faces to give room for deduplication.
    const rawResults = await prisma.$queryRawUnsafe<Array<{
      id: string;
      confidence: number;
      url: string;
      eventName: string;
      eventDate: Date;
    }>>(`
      SELECT 
        f."photoId" as "id", 
        (1 - (f.embedding <=> $1::vector)) as "confidence",
        p."storageUrl" as "url",
        e."name" as "eventName",
        e."date" as "eventDate"
      FROM "faces" f
      JOIN "photos" p ON f."photoId" = p."id"
      JOIN "events" e ON p."eventId" = e."id"
      ORDER BY f.embedding <=> $1::vector ASC
      LIMIT 20
    `, vectorString);

    // 4. Filter out duplicates by photo ID (in case one photo has multiple matching faces)
    const uniqueResults = Array.from(
      new Map(rawResults.map(r => [r.id, r])).values()
    );

    // Limit the final output to 10 like the original NestJS logic
    const finalResults = uniqueResults.slice(0, 10);

    return NextResponse.json({
      message: `Found ${finalResults.length} matches`,
      results: finalResults,
    });

  } catch (error) {
    console.error('Search Face Error:', error);
    return NextResponse.json({ error: 'Search failed', results: [] }, { status: 500 });
  }
}
