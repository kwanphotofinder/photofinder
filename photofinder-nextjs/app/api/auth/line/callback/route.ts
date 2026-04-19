import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { JwtPayload } from '@/lib/auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const settingsUrl = new URL('/settings', url.origin);

  // Debug log: print everything LINE sent back to us
  console.log('[LINE Callback] error:', error);
  console.log('[LINE Callback] code:', code ? `${code.substring(0, 10)}...` : 'MISSING');
  console.log('[LINE Callback] state:', state ? 'present' : 'MISSING');
  console.log('[LINE Callback] full URL:', url.toString());

  if (error || !code || !state) {
    console.error('[LINE Callback] Early exit - error from LINE:', error, '| code missing:', !code, '| state missing:', !state);
    settingsUrl.searchParams.set('error', 'LINE_LINK_FAILED');
    return NextResponse.redirect(settingsUrl.toString());
  }

  try {
    // 1. Decode state to get the original auth token
    const decodedStateStr = Buffer.from(state, 'base64').toString('utf-8');
    const statePayload = JSON.parse(decodedStateStr);

    if (!statePayload.token) {
      throw new Error('No auth token provided in state');
    }

    // 2. Identify the user
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET missing');
    
    const userPayload = jwt.verify(statePayload.token, jwtSecret) as JwtPayload;
    if (!userPayload?.sub) throw new Error('Invalid token');

    // 3. Exchange code for access_token and id_token using API
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${url.origin}/api/auth/line/callback`,
        client_id: process.env.LINE_CHANNEL_ID || '',
        client_secret: process.env.LINE_CHANNEL_SECRET || '',
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json();
      console.error('LINE Token Error:', errData);
      throw new Error('Failed to get token from LINE');
    }

    const { id_token } = await tokenResponse.json();

    // 4. Decode the id_token to extract LINE userId (sub)
    const decodedIdToken = jwt.decode(id_token) as { sub: string } | null;
    if (!decodedIdToken || !decodedIdToken.sub) {
      throw new Error('Invalid ID token from LINE');
    }

    const lineUserId = decodedIdToken.sub;

    // 5. Update user in Database
    await prisma.user.update({
      where: { id: userPayload.sub },
      data: { lineUserId },
    });

    settingsUrl.searchParams.set('success', 'LINE_LINKED');
    return NextResponse.redirect(settingsUrl.toString());
  } catch (err) {
    console.error('Error linking LINE account:', err);
    settingsUrl.searchParams.set('error', 'LINE_LINK_ERROR');
    return NextResponse.redirect(settingsUrl.toString());
  }
}
