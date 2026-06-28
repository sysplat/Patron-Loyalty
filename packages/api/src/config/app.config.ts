import { registerAs } from '@nestjs/config';
import { DEFAULT_NOREPLY_EMAIL } from '@queueplatform/shared';

export const appConfig = registerAs('app', () => ({
  queueSessionFallbackHours: (() => {
    const raw = Number.parseInt(process.env.QUEUE_SESSION_FALLBACK_HOURS || '24', 10);
    if (!Number.isFinite(raw)) return 24;
    return Math.min(72, Math.max(12, raw));
  })(),
  queue: {
    /** Nightly cron cancels prior-session `waiting` tickets (see docs/architecture/queue-session.md). */
    closePriorSessionWaiting: process.env.APP_QUEUE_CLOSE_PRIOR_SESSION_WAITING !== 'false',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  deployProfile: process.env.API_DEPLOY_PROFILE?.trim().toLowerCase() || 'full',
  port: parseInt(process.env.PORT || '4000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  loyaltyUrl:
    process.env.LOYALTY_URL || process.env.NEXT_PUBLIC_LOYALTY_URL || 'http://localhost:3003',
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  /** Explicit false = disable multi-step visits for every organization (platform kill switch). */
  visitJourneysGloballyDisabled: process.env.FEATURE_VISIT_JOURNEYS === 'false',
  /** Explicit true = legacy mode: every organization gets multi-step without using the org toggle. */
  visitJourneysLegacyGlobalOn: process.env.FEATURE_VISIT_JOURNEYS === 'true',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
    /** Default 15m: short-lived access JWT; refresh (default 30d) extends browser sessions. */
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL || '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL || '2592000', 10),
    impersonationAccessTtl: (() => {
      const ttl = process.env.JWT_IMPERSONATION_TTL;
      if (!ttl) {
        throw new Error('JWT_IMPERSONATION_TTL configuration is required but missing.');
      }
      return parseInt(ttl, 10);
    })(),
  },

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    // Per-command timeout (ms) for the cache/pubsub client so a flapping Redis fails
    // fast instead of blocking requests. BullMQ uses its own connection.
    commandTimeoutMs: parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS || '2000', 10),
  },

  // Centrifugo
  centrifugo: {
    apiUrl: process.env.CENTRIFUGO_API_URL || 'http://localhost:8000/api',
    apiKey: process.env.CENTRIFUGO_API_KEY || '',
    secret: process.env.CENTRIFUGO_SECRET || '',
    webhookSecret: process.env.CENTRIFUGO_WEBHOOK_SECRET || '',
  },

  // Email
  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    from: process.env.EMAIL_FROM || DEFAULT_NOREPLY_EMAIL,
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },

  // SMS
  sms: {
    provider: process.env.SMS_PROVIDER || 'console',
  },

  // Rate Limiting
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    authTtl: parseInt(process.env.AUTH_THROTTLE_TTL || '60', 10),
    authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT || '5', 10),
  },

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Stripe (Billing)
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  },

  /** When true, user invite responses include inviteToken — only for scripted smoke/E2E. Never enable in real production tenants. */
  exposeInviteTokens: process.env.EXPOSE_INVITE_TOKENS === 'true',

  /** Display pairing code TTL (minutes). TV-initiated codes and legacy admin codes. */
  displayCodeExpiryMinutes: parseInt(process.env.DISPLAY_CODE_EXPIRY_MINUTES || '15', 10),
  /** Display session JWT lifetime (seconds). Refreshed automatically via API key. */
  displayTokenTtlSeconds: parseInt(process.env.DISPLAY_TOKEN_TTL_SECONDS || '86400', 10),

  // Privacy / retention automation
  privacy: {
    ticketPiiRetentionDays: parseInt(process.env.TICKET_PII_RETENTION_DAYS || '30', 10),
    ticketPiiAnonymizeDryRun: process.env.TICKET_PII_ANONYMIZE_DRY_RUN === 'true',
  },
}));
