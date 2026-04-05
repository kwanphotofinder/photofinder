import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const SUPER_ADMIN_EMAIL = 'kwanphotofinder@gmail.com';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return NextResponse.json({ error: 'Invalid Google token payload' }, { status: 401 });
    }

    const { email, name, picture, email_verified, hd } = payload;

    if (!email_verified) {
      return NextResponse.json({ error: 'Your Google email is not verified' }, { status: 401 });
    }

    // Check domain allowlist
    const allowedDomains = ['mfu.ac.th', 'lamduan.mfu.ac.th'];
    const allowedEmails = [SUPER_ADMIN_EMAIL];

    const isAllowedDomain = (typeof hd === 'string' && allowedDomains.includes(hd)) || allowedDomains.some((domain) => email.endsWith(`@${domain}`));
    const isAllowedEmail = allowedEmails.includes(email.toLowerCase());

    // Also allow any email that is already pre-registered in the database
    const existingUser = await prisma.user.findUnique({ where: { email } });
    const isPreRegistered = !!existingUser;

    // By default, only MFU emails or pre-registered users are allowed.
    // However, if the user requested to be able to login with any email, we can bypass this check.
    // if (!isAllowedDomain && !isAllowedEmail && !isPreRegistered) {
    //   return NextResponse.json({ error: 'You must use an MFU email or an authorized email to sign in' }, { status: 403 });
    // }

    let user = existingUser;

    if (!user) {
      // New user
      const role = email.toLowerCase() === SUPER_ADMIN_EMAIL ? Role.SUPER_ADMIN : Role.STUDENT;

      user = await prisma.user.create({
        data: {
          email,
          name: name || '',
          avatarUrl: picture || null,
          role,
        },
      });
    } else {
      // Existing user: sync avatar and name, but respect database role
      const updates: any = {};
      if (picture && user.avatarUrl !== picture) updates.avatarUrl = picture;
      if (name && user.name !== name) updates.name = name;
      if (email.toLowerCase() === SUPER_ADMIN_EMAIL && user.role !== Role.SUPER_ADMIN) {
        updates.role = Role.SUPER_ADMIN;
      }

      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { email },
          data: updates,
        });
      }
    }

    // Sign JWT Token
    // Make sure JWT_SECRET is added to .env.local
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_for_development';
    const jwtToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '7d' } // You can match your NestJS expiration here
    );

    return NextResponse.json({
      access_token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        pdpaConsent: user.pdpaConsent,
        avatarUrl: user.avatarUrl,
      },
    }, { status: 200 });
    
  } catch (error) {
    console.error('Google token verification failed', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}
