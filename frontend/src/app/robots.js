const DISALLOW = ['/admin', '/api', '/auth', '/compte'];

export default function robots() {
  return {
    rules: [
      // Règle générale
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      // Crawlers IA — autorisés sur le contenu public
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: DISALLOW,
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: DISALLOW,
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: DISALLOW,
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: DISALLOW,
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: DISALLOW,
      },
    ],
    sitemap: 'https://auxptitspois.fr/sitemap.xml',
    host: 'https://auxptitspois.fr',
  };
}
