/* Posés ici plutôt que dans le proxy : headers() s'applique aussi aux fichiers
   que son matcher exclut (_next/static, public/). La CSP reste au proxy, son
   nonce change à chaque requête. */
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sans cela, le lockfile racine (concurrently) fait prendre tout le dépôt pour le projet.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
