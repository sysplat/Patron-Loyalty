import { toast } from 'sonner';
import { INTERNAL_PLATFORM_ORG_SLUG, PRODUCT_SKUS } from '@queueplatform/shared';

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type BulkStatusResult = {
  suspend: boolean;
  succeeded: { id: string; name: string; slug: string }[];
  skipped: { id: string; reason: string; name?: string; slug?: string }[];
  failed: { id: string; reason: string; name?: string; slug?: string }[];
};

export type BillingPlanOption = {
  slug: string;
  name: string;
};

/** QMS orgs with no active subscription are in setup mode — not a free plan. */
export const SETUP_MODE_PLAN_LABEL = 'Setup mode (no plan)';

const ONBOARDING_STEP_LABELS: Record<string, string> = {
  email_verification: 'Email verification',
  service_selection: 'Service selection',
  company_profile: 'Company profile',
  location_setup: 'Location setup',
  review_setup: 'Review setup',
  completed: 'Completed',
};

const PRODUCT_SKU_LABELS: Record<string, string> = {
  [PRODUCT_SKUS.QMS]: 'Queue (QMS)',
  [PRODUCT_SKUS.LOYALTY]: 'Loyalty only',
  [PRODUCT_SKUS.BUNDLE]: 'Queue + Loyalty',
};

export function isSelectableTenant(org: OrganizationRow): boolean {
  return org.slug !== INTERNAL_PLATFORM_ORG_SLUG;
}

export function isProtectedPlatformOrg(slug: string): boolean {
  return slug === INTERNAL_PLATFORM_ORG_SLUG;
}

export function formatTenantPlanLabel(
  subscription?: { plan?: { name?: string | null } | null } | null,
): string {
  const name = subscription?.plan?.name?.trim();
  return name ? name : SETUP_MODE_PLAN_LABEL;
}

export function formatTenantPlanSlug(
  subscription?: { plan?: { slug?: string | null } | null } | null,
): string {
  return subscription?.plan?.slug?.trim() || '';
}

export function formatOnboardingStep(step: string): string {
  return ONBOARDING_STEP_LABELS[step] ?? step.replace(/_/g, ' ');
}

export function formatProductSku(sku: string | null | undefined): string {
  if (!sku) return PRODUCT_SKU_LABELS[PRODUCT_SKUS.QMS];
  return PRODUCT_SKU_LABELS[sku] ?? sku;
}

export function formatBulkResultToast(result: BulkStatusResult, suspend: boolean): void {
  const action = suspend ? 'Suspended' : 'Restored';
  const parts: string[] = [];
  if (result.succeeded.length > 0) {
    parts.push(
      `${action} ${result.succeeded.length} organization${result.succeeded.length === 1 ? '' : 's'}`,
    );
  }
  if (result.skipped.length > 0) {
    parts.push(`${result.skipped.length} skipped`);
  }
  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} failed`);
  }
  const message = parts.join('. ') || 'No organizations were updated';
  if (result.succeeded.length > 0) {
    toast.success(message);
  } else if (result.failed.length > 0) {
    toast.error(message);
  } else {
    toast.info(message);
  }
}
