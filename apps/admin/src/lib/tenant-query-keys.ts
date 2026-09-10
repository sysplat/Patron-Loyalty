/** React Query keys for platform-admin tenant list + detail (keep in sync across pages). */
export const tenantQueryKeys = {
  all: ['ops', 'organizations'] as const,
  list: (skip: number, search: string) => ['ops', 'organizations', skip, search] as const,
  detail: (id: string) => ['ops', 'tenant', id] as const,
  users: (id: string, skip: number, take: number) =>
    ['ops', 'tenant', id, 'users', skip, take] as const,
  deploymentFeatures: ['ops', 'deployment', 'features'] as const,
};
