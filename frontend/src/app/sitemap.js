export default function sitemap() {
  const baseUrl = 'https://auxptitspois.fr';

  const routes = [
    { url: '/', priority: 1.0, changeFrequency: 'weekly' },
    { url: '/nos-abonnements', priority: 0.9, changeFrequency: 'monthly' },
    { url: '/nos-producteurs', priority: 0.8, changeFrequency: 'monthly' },
    { url: '/panier-semaine', priority: 0.8, changeFrequency: 'weekly' },
    { url: '/devenir-producteur', priority: 0.7, changeFrequency: 'monthly' },
    { url: '/recettes', priority: 0.6, changeFrequency: 'weekly' },
    { url: '/faq', priority: 0.6, changeFrequency: 'monthly' },
    { url: '/contact', priority: 0.5, changeFrequency: 'yearly' },
    { url: '/mentions-legales', priority: 0.2, changeFrequency: 'yearly' },
  ];

  return routes.map(({ url, priority, changeFrequency }) => ({
    url: `${baseUrl}${url}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
