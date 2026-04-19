import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const redirectUri = `${url.origin}/api/auth/line/callback`;

  // Encode token inside the state so we can recover it after LINE redirect
  const statePayload = Buffer.from(JSON.stringify({ token, random: Date.now() })).toString('base64');

  const lineLoginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
  lineLoginUrl.searchParams.append('response_type', 'code');
  lineLoginUrl.searchParams.append('client_id', process.env.LINE_CHANNEL_ID || '');
  lineLoginUrl.searchParams.append('redirect_uri', redirectUri);
  lineLoginUrl.searchParams.append('state', statePayload); 
  lineLoginUrl.searchParams.append('scope', 'profile openid');

  // Debug: print the exact URL and redirect_uri being sent to LINE
  console.log('[LINE Login] Channel ID:', process.env.LINE_CHANNEL_ID);
  console.log('[LINE Login] Redirect URI sent to LINE:', redirectUri);

  return NextResponse.redirect(lineLoginUrl.toString());
}
