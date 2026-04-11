import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from './prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export async function getUserFromRequest(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is missing');
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    
    // Optional: If you want to fetch fresh state from the DB
    // const user = await prisma.user.findUnique({ where: { id: decoded.sub }});
    // return user;

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Example Usage in an API Route:
 * 
 * import { getUserFromRequest } from '@/lib/auth';
 * 
 * export async function POST(req: NextRequest) {
 *   const user = await getUserFromRequest(req);
 *   if (!user || user.role !== 'ADMIN') {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // Proceed...
 * }
 */
