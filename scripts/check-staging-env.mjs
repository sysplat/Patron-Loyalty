#!/usr/bin/env node

/**
 * Non-domain staging preflight for API + worker deployments.
 * Fails on missing critical environment variables.
 */

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'APP_URL',
  'API_URL',
  'ENCRYPTION_KEY',
];

const recommended = [
  'APP_ALLOWED_ORIGINS',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'CENTRIFUGO_WEBHOOK_SECRET',
  'CENTRIFUGO_SECRET',
  'CENTRIFUGO_API_KEY',
  'CENTRIFUGO_API_URL',
  'TWILIO_SENDGRID_API_KEY',
  'TWILIO_SENDGRID_FROM_EMAIL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_STATUS_CALLBACK_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

function printMissing(label, keys) {
  if (keys.length === 0) return;
  console.log(`${label}:`);
  for (const key of keys) {
    console.log(`- ${key}`);
  }
}

const missingRequired = required.filter((key) => !process.env[key]);
const missingRecommended = recommended.filter((key) => !process.env[key]);

printMissing('Missing required vars', missingRequired);
printMissing('Missing recommended vars', missingRecommended);

if (process.env.JWT_SECRET === 'change-me' || process.env.JWT_REFRESH_SECRET === 'change-me-refresh') {
  console.log('JWT secrets are using insecure defaults.');
  process.exit(1);
}

if (missingRequired.length > 0) {
  process.exit(1);
}

console.log('Staging env preflight passed.');

