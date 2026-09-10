'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Silently auto-detects the browser timezone on first dashboard load and
 * applies it to the organisation if the org is still on the default "UTC"
 * value (meaning the owner never explicitly set one).
 *
 * Only the organization owner may PATCH organization profile (including timezone).
 * Only fires once per mount. No UI is rendered — side-effects only.
 */
export function TimezoneAutoDetect() {
  const didRun = useRef(false);
  const user = useAuthStore((s) => s.user);
  const isOwner = String(user?.role ?? '').toLowerCase() === 'owner';

  useEffect(() => {
    if (!user?.id) return;
    if (didRun.current) return;
    if (!isOwner) {
      didRun.current = true;
      return;
    }
    didRun.current = true;

    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Nothing useful to detect
    if (!browserTz || browserTz === 'UTC') return;

    api
      .get<{ success: boolean; data: { timezone: string } }>('/organization')
      .then(({ data }) => {
        // Only auto-set if the org is still on the unset default
        if (data.timezone !== 'UTC') return;

        return api.patch('/organization', { timezone: browserTz }).then(() => {
          toast.info(`Timezone set to ${browserTz}`, {
            description: 'Detected from your browser. You can change it in Organization settings.',
            duration: 6000,
          });
        });
      })
      .catch(() => {
        // Non-critical — silently ignore any failure
      });
  }, [user?.id, isOwner]);

  return null;
}
