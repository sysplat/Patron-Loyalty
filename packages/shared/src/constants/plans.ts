// ─── Subscription Plans ──────────────────────────

import type { PlanLimits } from '../types/api.types';
import { DEFAULT_SMS_CREDITS_BY_PLAN_SLUG } from './sms-credits';

export interface PlanDefinition {
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: Record<string, boolean>;
  limits: PlanLimits;
}

export const PLANS: Record<string, PlanDefinition> = {
  FREE: {
    name: 'Free',
    slug: 'free',
    priceMonthly: 0,
    priceYearly: 0,
    description: 'Get started with basic queue management',
    features: {
      queueManagement: true,
      onlineBooking: true,
      emailNotifications: true,
      basicReports: true,
      appointments: false,
      smsNotifications: true,
      advancedReports: false,
      customBranding: false,
      apiAccess: false,
      digitalSignage: false,
    },
    limits: {
      maxBranches: 1,
      maxUsers: 3,
      maxQueuesPerBranch: 3,
      maxTicketsPerMonth: 100,
      maxDevices: 1,
      hasAdvancedReports: false,
      hasCustomBranding: false,
      hasSmsNotifications: true,
      hasApiAccess: false,
      hasCrmIntegration: false,
      smsCreditsTotal: DEFAULT_SMS_CREDITS_BY_PLAN_SLUG.free,
    },
  },
  PROFESSIONAL: {
    name: 'Professional',
    slug: 'professional',
    priceMonthly: 49,
    priceYearly: 470,
    description: 'For growing businesses with multiple services',
    features: {
      queueManagement: true,
      onlineBooking: true,
      emailNotifications: true,
      basicReports: true,
      appointments: true,
      smsNotifications: true,
      advancedReports: false,
      customBranding: false,
      apiAccess: false,
      digitalSignage: true,
    },
    limits: {
      maxBranches: 3,
      maxUsers: 10,
      maxQueuesPerBranch: 10,
      maxTicketsPerMonth: 1000,
      maxDevices: 5,
      hasAdvancedReports: false,
      hasCustomBranding: false,
      hasSmsNotifications: true,
      hasApiAccess: false,
      hasCrmIntegration: false,
      smsCreditsTotal: DEFAULT_SMS_CREDITS_BY_PLAN_SLUG.professional,
    },
  },
  ENTERPRISE: {
    name: 'Enterprise',
    slug: 'enterprise',
    priceMonthly: 149,
    priceYearly: 1430,
    description: 'Full-featured for large organizations',
    features: {
      queueManagement: true,
      onlineBooking: true,
      emailNotifications: true,
      basicReports: true,
      appointments: true,
      smsNotifications: true,
      advancedReports: true,
      customBranding: true,
      apiAccess: true,
      digitalSignage: true,
    },
    limits: {
      maxBranches: 20,
      maxUsers: 50,
      maxQueuesPerBranch: 50,
      maxTicketsPerMonth: 10000,
      maxDevices: 50,
      hasAdvancedReports: true,
      hasCustomBranding: true,
      hasSmsNotifications: true,
      hasApiAccess: true,
      hasCrmIntegration: true,
      smsCreditsTotal: DEFAULT_SMS_CREDITS_BY_PLAN_SLUG.enterprise,
    },
  },
};

/** Standalone Patron Loyalty (LMS) — sold without QlessQ queue. */
export const LOYALTY_STARTER: PlanDefinition = {
  name: 'Loyalty Starter',
  slug: 'loyalty-starter',
  priceMonthly: 29,
  priceYearly: 278,
  description: 'Patron CRM, points, tiers, and campaigns — no queue management',
  features: {
    queueManagement: false,
    onlineBooking: false,
    emailNotifications: true,
    basicReports: true,
    appointments: false,
    smsNotifications: true,
    advancedReports: false,
    customBranding: false,
    apiAccess: false,
    digitalSignage: false,
    patronLoyalty: true,
  },
  limits: {
    maxBranches: 1,
    maxUsers: 5,
    maxQueuesPerBranch: 0,
    maxTicketsPerMonth: 0,
    maxDevices: 0,
    hasAdvancedReports: false,
    hasCustomBranding: false,
    hasSmsNotifications: true,
    hasApiAccess: false,
    hasCrmIntegration: true,
    smsCreditsTotal: 500,
  },
};

export const PLAN_SLUGS = Object.values(PLANS).map((p) => p.slug);
export const ALL_PLAN_SLUGS = [...PLAN_SLUGS, LOYALTY_STARTER.slug];
