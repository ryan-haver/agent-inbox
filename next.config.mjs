/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Disable telemetry in production
  productionBrowserSourceMaps: false,
  
  // Reverse proxy support: Configure basePath for subpath deployments
  // Examples:
  //   - Root domain: basePath = '' (default)     → https://inbox.example.com/
  //   - Subpath:     basePath = '/inbox'         → https://example.com/inbox/
  //
  // Set via environment variable: NEXT_PUBLIC_BASE_PATH
  // Leave empty for root domain deployment (recommended)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  
  // Asset prefix follows basePath automatically
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
};

export default nextConfig;
