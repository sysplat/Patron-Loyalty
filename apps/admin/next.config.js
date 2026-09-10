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
    optimizePackageImports: ['lucide-react', 'recharts', 'luxon', 'date-fns'],
    cpus: 1,
    workerThreads: false,
    memoryBasedWorkersCount: true,
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.queueplatform.com' },
      { protocol: 'https', hostname: '*.sysplat.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: browserApiUrl,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
    NEXT_PUBLIC_LOYALTY_URL: process.env.NEXT_PUBLIC_LOYALTY_URL ?? '',
    NEXT_PUBLIC_SENTRY_RELEASE:
      process.env.SENTRY_RELEASE ??
      process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      '',
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
};

const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_ADMIN || process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  errorHandler: (err) => {
    if (process.env.SENTRY_REQUIRE_SOURCE_MAPS === '1') {
      throw err;
    }
    console.warn('[sentry] source map upload warning:', err);
  },
};

module.exports = process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(withBundleAnalyzer(nextConfig), sentryBuildOptions)
  : withBundleAnalyzer(nextConfig);
