import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS for the JSON API. Native apps send no Origin header and are unaffected;
 * browser origins (Expo web in development, future web clients) must be listed
 * in API_ALLOWED_ORIGINS.
 */
const allowed = new Set(
  (process.env.API_ALLOWED_ORIGINS ?? 'http://localhost:8081,http://localhost:19006')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept-Language',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const permitted = origin && allowed.has(origin);
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: permitted ? corsHeaders(origin) : {} });
  }
  const response = NextResponse.next();
  if (permitted) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
