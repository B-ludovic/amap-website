export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/auth', '/compte'],
      },
    ],
    sitemap: 'https://auxptitspois.fr/sitemap.xml',
  };
}
