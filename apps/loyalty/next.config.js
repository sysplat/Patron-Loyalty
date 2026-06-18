const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const { securityHeaders } = require('../../scripts/next-security-headers.cjs');
const {
  loadMonorepoEnv,
  resolveApiUpstreamUrl,
  resolveBrowserApiUrl,
} = require('../../scripts/load-monorepo-env.cjs');

loadMonorepoEnv(__dirname);
const isDev = process.env.NODE_ENV !== 'production' || process.argv.includes('dev');
const apiUpstream = resolveApiUpstreamUrl();
const browserApiUrl = resolveBrowserApiUrl(isDev);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@queueplatform/shared', '@queueplatform/frontend-core'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Tree-shake heavy barrel imports so dashboard routes only ship what they use.
    optimizePackageImports: ['lucide-react', 'recharts', 'luxon', 'date-fns'],
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [{ protocol: 'https', hostname: '*.queueplatform.com' }],
  },
  // Expose Stripe publishable key to client-side code.
  // NEXT_PUBLIC_* vars are automatically inlined by Next.js at build time;
  // listing them here makes the value available via process.env in the browser.
  env: {
    NEXT_PUBLIC_API_URL: browserApiUrl,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
    NEXT_PUBLIC_SENTRY_RELEASE:
      process.env.SENTRY_RELEASE ??
      process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      '',
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
  },
  async rewrites() {
    if (!isDev) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUpstream}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders() }];
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: false },
      { source: '/dashboard/:path*', destination: '/:path*', permanent: false },
    ];
  },
};

const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
};

module.exports = process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(withBundleAnalyzer(nextConfig), sentryBuildOptions)
  : withBundleAnalyzer(nextConfig);
