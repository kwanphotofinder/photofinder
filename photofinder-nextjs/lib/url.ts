function normalizeBaseUrl(raw: string): string {
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function getAppBaseUrl(requestUrl?: string): string {
  const configuredBaseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');

  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  if (requestUrl) {
    return normalizeBaseUrl(new URL(requestUrl).origin);
  }

  return 'http://localhost:3000';
}

export function getLineRedirectUri(requestUrl?: string): string {
  if (process.env.LINE_REDIRECT_URI) {
    return process.env.LINE_REDIRECT_URI;
  }

  return `${getAppBaseUrl(requestUrl)}/api/auth/line/callback`;
}
