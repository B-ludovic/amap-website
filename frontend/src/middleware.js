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

  /* CE MIDDLEWARE NE GARDE AUCUNE ROUTE, ET C'EST DÉLIBÉRÉ.

     /admin n'est pas filtré ici. Le contrôle d'accès est côté API — authMiddleware
     puis adminOnly sur /api/admin/* — et il doit y rester : le navigateur ne
     décide pas qui est administrateur. Un visiteur non authentifié qui ouvre
     /admin/utilisateurs reçoit une coquille sans données, ses appels repartent en
     401, et AdminLayoutClient le redirige. Rien ne fuit.

     La tentation, à la lecture, est d'ajouter ici un test de confort du genre :

       if (pathname.startsWith('/admin') && !request.cookies.has('authToken'))
         return NextResponse.redirect(new URL('/auth/login', request.url));

     Ne pas le faire sans changer autre chose d'abord. Le cookie d'authentification
     est posé par l'API sans attribut Domain — vérifié sur l'en-tête Set-Cookie
     réellement émis —, il est donc host-only : il appartient à api.auxptitspois.fr
     et n'est jamais envoyé à auxptitspois.fr, où tourne ce middleware. Le test
     ci-dessus serait donc toujours faux en production et redirigerait les
     administrateurs vers la page de connexion en boucle, /admin devenant
     inaccessible.

     Le piège est qu'il fonctionne parfaitement en local : le front est sur
     localhost:3000, l'API sur localhost:4000, et les cookies ignorent le port —
     même hôte, donc cookie visible. C'est le scénario « ça marche chez moi » dans
     sa forme la plus coûteuse, puisqu'il ne casse qu'une fois déployé.

     Deux voies si le confort devient nécessaire : donner au cookie une portée de
     domaine (domain: '.auxptitspois.fr'), ce qui l'expose alors à tous les
     sous-domaines et se décide en connaissance de cause ; ou servir l'API sous le
     même hôte que le front via des rewrites Next. Dans les deux cas, cela reste un
     confort d'affichage, jamais un contrôle d'accès. */

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
