import { NextRequest, NextResponse } from 'next/server';
import { authenticateGoogleToken, createAuthRedirectHtml } from '../route';

export async function POST(req: NextRequest) {
  try {
    let token: string | null = null;
    const contentType = req.headers.get('content-type') || '';
    const isFormSubmit = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');

    if (contentType.includes('application/json')) {
      const body = await req.json();
      token = body.token;
    } else {
      const formData = await req.formData();
      token = (formData.get('credential') as string) || (formData.get('token') as string);
    }

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent('Google token is missing'), req.url));
    }

    const authResult = await authenticateGoogleToken(token);

    if (isFormSubmit) {
      return createAuthRedirectHtml(authResult.access_token, authResult.user);
    }

    return NextResponse.json(authResult, { status: 200 });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Google authentication failed';
    console.error('[Google Callback] Error:', errorMessage);
    return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(errorMessage), req.url));
  }
}

export async function GET(req: NextRequest) {
  // If user navigates directly or Google returns GET with code/error
  const error = req.nextUrl.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
  }
  return NextResponse.redirect(new URL('/login', req.url));
}
