/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sans cela, le lockfile racine (concurrently) fait prendre tout le dépôt pour le projet.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
