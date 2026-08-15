import { NextResponse } from 'next/server';

export function middleware(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  const apiOrigin = new URL(rawApiUrl).origin;

  const isProd = process.env.NODE_ENV === 'production';

  const csp = [
    "default-src 'self'",
    /* 'unsafe-eval' n'est requis que par les source maps eval de webpack en
       développement. En production il n'a aucun usage et rouvre les gadgets de
       contournement de strict-dynamic. */
    `script-src 'nonce-${nonce}' 'strict-dynamic'${isProd ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} https://www.google-analytics.com https://stats.g.doubleclick.net https://region1.google-analytics.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join('; ');

  // Seul x-nonce a besoin d'être transmis au rendu : la CSP est un en-tête de
  // réponse, la poser sur la requête n'a aucun effet.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
