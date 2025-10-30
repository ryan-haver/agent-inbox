/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Disable telemetry in production
  productionBrowserSourceMaps: false,
};

export default nextConfig;
