import {
  buildImpersonationLaunchUrl,
  IMPERSONATION_HANDOFF_PATH,
  type ImpersonationHandoffPayload,
  PRODUCT_SKUS,
  resolveLoyaltyAppUrl,
  resolveTenantWebUrl,
} from '@queueplatform/shared';

type LaunchImpersonationParams = {
  accessToken: string;
  orgId: string;
  orgName: string;
  role: string;
  operatorOrgSlug: string;
  productSku?: string;
  simulatedBranchId?: string | null;
  simulatedBranchName?: string | null;
  roleSimulation?: boolean;
  returnUrl?: string;
  operator: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
};

function tenantWebBaseUrl(): string {
  return resolveTenantWebUrl(
    undefined,
    typeof window !== 'undefined' ? window.location.hostname : undefined,
  );
}

function tenantLoyaltyBaseUrl(): string {
  return resolveLoyaltyAppUrl();
}

function handoffPayload(params: LaunchImpersonationParams): ImpersonationHandoffPayload {
  return {
    accessToken: params.accessToken,
    orgId: params.orgId,
    orgName: params.orgName,
    operatorOrgSlug: params.operatorOrgSlug,
    role: params.role,
    roleSimulation: params.roleSimulation,
    simulatedBranchId: params.simulatedBranchId ?? undefined,
    simulatedBranchName: params.simulatedBranchName ?? undefined,
    operator: params.operator,
    returnUrl: params.returnUrl,
  };
}

/** Open tenant web or loyalty app with cross-origin impersonation hash handoff. */
export function buildTenantImpersonationLaunchUrl(params: LaunchImpersonationParams): string {
  const productSku = params.productSku ?? PRODUCT_SKUS.LOYALTY;
  // Loyalty-only → LMS app; Queue and Appointments-only → tenant web.
  const base = productSku === PRODUCT_SKUS.LOYALTY ? tenantLoyaltyBaseUrl() : tenantWebBaseUrl();
  return buildImpersonationLaunchUrl(base, IMPERSONATION_HANDOFF_PATH, handoffPayload(params));
}

/** @deprecated Same-origin only — use buildTenantImpersonationLaunchUrl for production admin → tenant apps. */
export function launchTenantImpersonation(
  params: Omit<LaunchImpersonationParams, 'operatorOrgSlug' | 'operator'>,
): void {
  if (typeof window === 'undefined') return;

  try {
    const webStoreStr = localStorage.getItem('qp-auth-v2-user');
    const webStore = webStoreStr ? JSON.parse(webStoreStr) : { state: { user: {} }, version: 0 };

    webStore.state = webStore.state || {};
    webStore.state.accessToken = params.accessToken;
    webStore.state.user = {
      ...(webStore.state.user || {}),
      orgId: params.orgId,
      orgName: params.orgName,
      role: params.role,
      impersonation: true,
      roleSimulation: params.roleSimulation ?? false,
      simulatedBranchId: params.simulatedBranchId ?? undefined,
      simulatedBranchName: params.simulatedBranchName ?? undefined,
    };

    localStorage.setItem('qp-auth-v2-user', JSON.stringify(webStore));
  } catch (e) {
    console.error('Failed to sync impersonation to web store', e);
  }
}

export function patchTenantImpersonationSession(
  params: Omit<LaunchImpersonationParams, 'operatorOrgSlug' | 'operator'>,
): void {
  launchTenantImpersonation(params);
}
