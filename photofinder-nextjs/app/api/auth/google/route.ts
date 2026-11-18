import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const DEFAULT_SUPER_ADMIN_EMAILS = ['kwanphotofinder@gmail.com'];

function checkIsSuperAdmin(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const envAdmins = (process.env.SUPER_ADMIN_EMAIL || '')
    .toLowerCase()
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const allSuperAdmins = new Set([...DEFAULT_SUPER_ADMIN_EMAILS, ...envAdmins]);
  return allSuperAdmins.has(normalized);
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

export async function authenticateGoogleToken(token: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google login is not configured on the server');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  const { email, name, picture, email_verified, hd } = payload;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedHostedDomain = typeof hd === 'string' ? hd.trim().toLowerCase() : '';

  if (!email_verified) {
    throw new Error('Your Google email is not verified');
  }

  // Check domain allowlist
  const allowedDomains = ['mfu.ac.th', 'lamduan.mfu.ac.th'];
  const isAllowedDomain = allowedDomains.includes(normalizedHostedDomain) || allowedDomains.some((domain) => normalizedEmail.endsWith(`@${domain}`));
  const isSuperAdminEmail = checkIsSuperAdmin(normalizedEmail);

  // Also allow any email that is already pre-registered in the database
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const isPreRegistered = !!existingUser;

  // By default, only MFU emails, super admin, or pre-registered users are allowed.
  if (!isAllowedDomain && !isSuperAdminEmail && !isPreRegistered) {
    throw new Error('You must use an MFU email or an authorized email to sign in');
  }

  let user = existingUser;

  if (user && "isActive" in user && (user as any).isActive === false) {
    const allowAutoReactivate = !IS_PRODUCTION || isSuperAdminEmail;

    if (!allowAutoReactivate) {
      throw new Error('Your account has been deactivated. Please contact support.');
    }

    user = await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        role: isSuperAdminEmail ? Role.SUPER_ADMIN : user.role,
      },
    });
  }

  if (!user) {
    // New user
    const role = isSuperAdminEmail ? Role.SUPER_ADMIN : Role.STUDENT;

    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
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
    if (isSuperAdminEmail && user.role !== Role.SUPER_ADMIN) {
      updates.role = Role.SUPER_ADMIN;
    }

    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({
        where: { email: normalizedEmail },
        data: updates,
      });
    }
  }

  // Sign JWT Token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const jwtToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  return {
    access_token: jwtToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      pdpaConsent: user.pdpaConsent,
      avatarUrl: user.avatarUrl,
    },
  };
}

export function createAuthRedirectHtml(accessToken: string, user: any) {
  const destination =
    user.role === 'PHOTOGRAPHER'
      ? '/photographer'
      : user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
      ? '/admin/dashboard'
      : user.pdpaConsent
      ? '/dashboard'
      : '/consent';

  const adminTokenSet =
    user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
      ? `localStorage.setItem("admin_token", ${JSON.stringify(accessToken)}); localStorage.setItem("admin_name", ${JSON.stringify(user.name)});`
      : `localStorage.removeItem("admin_token"); localStorage.removeItem("admin_name");`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Signing in...</title>
  <style>
    body {
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 1rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #82181a;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div>
    <div class="spinner"></div>
    <p>Signing in to PhotoFinder, please wait...</p>
  </div>
  <script>
    try {
      localStorage.setItem("auth_token", ${JSON.stringify(accessToken)});
      localStorage.setItem("user_id", ${JSON.stringify(user.id)});
      localStorage.setItem("user_data", JSON.stringify(${JSON.stringify(user)}));
      localStorage.setItem("user_name", ${JSON.stringify(user.name)});
      localStorage.setItem("user_email", ${JSON.stringify(user.email)});
      localStorage.setItem("user_role", ${JSON.stringify(user.role.toLowerCase())});
      ${adminTokenSet}
      window.location.replace(${JSON.stringify(destination)});
    } catch (err) {
      window.location.replace("/login?error=" + encodeURIComponent("Failed to save credentials in browser"));
    }
  </script>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });

  response.cookies.set('auth_token', accessToken, {
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

export async function POST(req: NextRequest) {
  try {
    let token: string | null = null;
    const contentType = req.headers.get('content-type') || '';
    const isFormSubmit = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');

    if (contentType.includes('application/json')) {
      const body = await req.json();
      token = body.token;
    } else if (isFormSubmit) {
      const formData = await req.formData();
      token = (formData.get('credential') as string) || (formData.get('token') as string);
    }

    if (!token) {
      if (isFormSubmit) {
        return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent('Token is required'), req.url));
      }
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const authResult = await authenticateGoogleToken(token);

    if (isFormSubmit) {
      return createAuthRedirectHtml(authResult.access_token, authResult.user);
    }

    return NextResponse.json(authResult, { status: 200 });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
    console.error('Google login failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: errorMessage,
    });

    const contentType = req.headers.get('content-type') || '';
    const isFormSubmit = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');

    if (isFormSubmit) {
      return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMessage), req.url));
    }

    return NextResponse.json({ error: errorMessage }, { status: 401 });
  }
}
