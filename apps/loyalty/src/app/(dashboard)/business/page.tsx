'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACTIONS,
  ORGANIZATION_LOGO_MAX_DIMENSION_PX,
  ORGANIZATION_LOGO_MAX_UPLOAD_BYTES,
  ORGANIZATION_LOGO_UPLOAD_HINT,
  RESOURCES,
  organizationLogoFileTooLargeMessage,
} from '@queueplatform/shared';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { api } from '@/lib/api';
import { loyaltyGet, loyaltyPatch, unwrapApiData } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { hasPermission, isOrganizationOwner } from '@/lib/rbac-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  MapPin,
  RefreshCw,
  Trash2,
} from 'lucide-react';

interface OrgProfile {
  id?: string;
  name: string;
  slug?: string;
  website?: string | null;
  industry?: string | null;
  timezone: string;
  country?: string | null;
  hasLogo?: boolean;
}

interface BranchRow {
  id: string;
  name: string;
  slug?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  timezone?: string | null;
}

interface ProgramRow {
  displayCurrencyCode?: string;
  pointsCurrencyName?: string;
}

const GUIDE: { title: string; body: string }[] = [
  {
    title: 'Brand',
    body: 'Business name and logo appear in the staff sidebar and on patron-facing surfaces.',
  },
  {
    title: 'Timezone',
    body: 'Used for reports, campaigns, and date pickers across the loyalty workspace.',
  },
  {
    title: 'Store address',
    body: 'Saved on your primary location (branch). Add more locations later if you grow.',
  },
  {
    title: 'Currency',
    body: 'Display currency for wallets and gift cards. Points naming stays under Program.',
  },
];

const DISPLAY_CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'NZD', 'MXN', 'JPY', 'INR'] as const;

const FALLBACK_TIMEZONES = [
  'UTC',
  'America/Vancouver',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
];

function selectClassName(className?: string) {
  return cn(
    'border-input bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  );
}

function listTimezones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    if (supported && supported.length > 0) return supported;
  } catch {
    /* ignore */
  }
  return FALLBACK_TIMEZONES;
}

function pickPrimaryBranch(branches: BranchRow[]): BranchRow | null {
  if (branches.length === 0) return null;
  const main = branches.find((b) => String(b.slug ?? '').toLowerCase() === 'main');
  if (main) return main;
  return [...branches].sort((a, b) => a.name.localeCompare(b.name))[0] ?? null;
}

async function fileToResizedDataUrl(file: File): Promise<string> {
  if (file.size > ORGANIZATION_LOGO_MAX_UPLOAD_BYTES) {
    throw new Error(organizationLogoFileTooLargeMessage(file.size));
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a PNG, JPEG, GIF, or WebP image');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image'));
      el.src = objectUrl;
    });

    const max = ORGANIZATION_LOGO_MAX_DIMENSION_PX;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image');
    ctx.drawImage(img, 0, 0, width, height);

    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return canvas.toDataURL(mime, 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function BusinessPage() {
  const token = useAuthStore((s) => s.accessToken);
  const currentUserRole = useAuthStore((s) => String(s.user?.role ?? '').toLowerCase());
  const updateUser = useAuthStore((s) => s.updateUser);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = isOrganizationOwner(currentUserRole);
  const canReadOrg = hasPermission(currentUserRole, RESOURCES.ORGANIZATION, ACTIONS.READ);
  const canUpdateBranch = hasPermission(currentUserRole, RESOURCES.BRANCH, ACTIONS.UPDATE);
  const canUpdateProgram = hasPermission(currentUserRole, RESOURCES.CUSTOMER, ACTIONS.UPDATE);

  const [guideOpen, setGuideOpen] = useState(false);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [currencyHydrated, setCurrencyHydrated] = useState(false);
  const syncedBranchIdRef = useRef<string>('');

  const timezones = useMemo(() => listTimezones(), []);

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery({
    queryKey: ['organization', 'profile'],
    queryFn: () => loyaltyGet<OrgProfile>('/organization/profile', token!),
    enabled: !!token && canReadOrg,
  });

  const { data: logoPayload } = useQuery({
    queryKey: ['organization', 'logo'],
    queryFn: () => loyaltyGet<{ logoUrl: string | null }>('/organization/logo', token!),
    enabled: !!token && canReadOrg,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches', 'business'],
    queryFn: () =>
      api
        .get<unknown>('/branches', { token: token!, showErrorToast: false })
        .then((payload) => {
          const unwrapped = unwrapApiData<BranchRow[] | { data: BranchRow[] }>(payload);
          if (Array.isArray(unwrapped)) return unwrapped;
          if (unwrapped && typeof unwrapped === 'object' && 'data' in unwrapped) {
            return Array.isArray(unwrapped.data) ? unwrapped.data : [];
          }
          return [];
        })
        .catch(() => [] as BranchRow[]),
    enabled: !!token && canReadOrg,
  });

  const { data: program } = useQuery({
    queryKey: ['loyalty', 'program'],
    queryFn: () => loyaltyGet<ProgramRow>('/loyalty/program', token!),
    enabled: !!token && canReadOrg,
  });

  const selectedBranch = useMemo(() => {
    if (selectedBranchId) {
      return branches.find((b) => b.id === selectedBranchId) ?? null;
    }
    return pickPrimaryBranch(branches);
  }, [branches, selectedBranchId]);

  useEffect(() => {
    if (!profile || hydrated) return;
    setName(profile.name ?? '');
    setWebsite(profile.website ?? '');
    setIndustry(profile.industry ?? '');
    setTimezone(profile.timezone || 'UTC');
    setCountry(profile.country ?? '');
    setHydrated(true);
  }, [profile, hydrated]);

  useEffect(() => {
    if (!program || currencyHydrated) return;
    setDisplayCurrency((program.displayCurrencyCode ?? 'USD').toUpperCase());
    setCurrencyHydrated(true);
  }, [program, currencyHydrated]);

  useEffect(() => {
    if (!branches.length) return;
    if (!selectedBranchId) {
      const primary = pickPrimaryBranch(branches);
      if (primary) setSelectedBranchId(primary.id);
      return;
    }
    // Only hydrate address/phone when the selected branch changes — not on query refetch
    // (which would wipe in-progress edits on window focus).
    if (syncedBranchIdRef.current === selectedBranchId) return;
    const branch = branches.find((b) => b.id === selectedBranchId);
    if (!branch) return;
    syncedBranchIdRef.current = selectedBranchId;
    setAddress(branch.address ?? '');
    setBranchPhone(branch.phone ?? '');
  }, [branches, selectedBranchId]);

  function reloadFormsFromServer() {
    setHydrated(false);
    setCurrencyHydrated(false);
    syncedBranchIdRef.current = '';
    void qc.invalidateQueries({ queryKey: ['organization'] });
    void qc.invalidateQueries({ queryKey: ['branches'] });
    void qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
  }

  const saveIdentity = useMutation({
    mutationFn: () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Business name is required');
      const websiteValue = website.trim();
      if (websiteValue && !/^https?:\/\//i.test(websiteValue)) {
        throw new Error('Website must start with http:// or https://');
      }
      return api
        .patch<unknown>(
          '/organization',
          {
            name: trimmedName,
            website: websiteValue,
            industry: industry.trim(),
            timezone,
            country: country.trim(),
          },
          { token: token! },
        )
        .then((payload) => unwrapApiData(payload));
    },
    onSuccess: async () => {
      toast.success('Business identity saved');
      updateUser({ orgName: name.trim(), orgTimezone: timezone });
      await qc.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save identity'),
  });

  const saveLogo = useMutation({
    mutationFn: (logoUrl: string) =>
      api
        .patch<unknown>('/organization', { logoUrl }, { token: token! })
        .then((payload) => unwrapApiData(payload)),
    onSuccess: async () => {
      toast.success('Logo updated');
      await qc.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not update logo'),
  });

  const saveAddress = useMutation({
    mutationFn: () => {
      if (!selectedBranch) throw new Error('No store location found');
      const phone = branchPhone.trim();
      return api
        .patch<unknown>(
          `/branches/${selectedBranch.id}`,
          {
            address: address.trim(),
            ...(phone ? { phone } : {}),
          },
          { token: token! },
        )
        .then((payload) => unwrapApiData(payload));
    },
    onSuccess: async () => {
      toast.success('Store address saved');
      // Keep local edits; only refresh list metadata without re-hydrating the form.
      await qc.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save address'),
  });

  const saveCurrency = useMutation({
    mutationFn: () => {
      const code = displayCurrency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) throw new Error('Currency must be a 3-letter code (e.g. USD)');
      return loyaltyPatch('/loyalty/program', token!, { displayCurrencyCode: code });
    },
    onSuccess: async () => {
      toast.success('Display currency saved');
      setCurrencyHydrated(true);
      await qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not save currency'),
  });

  async function onLogoFile(file: File | null) {
    if (!file || !isOwner) return;
    setLogoBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      try {
        await saveLogo.mutateAsync(dataUrl);
      } catch {
        // saveLogo.onError already toasted
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload logo');
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (!canReadOrg) {
    return (
      <div className="space-y-5 pb-10">
        <div>
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Business</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Only owners can manage business identity and brand.
          </p>
        </div>
        <Card>
          <CardContent className="flex items-start gap-3 p-5 text-sm">
            <AlertTriangle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-muted-foreground">Ask your owner to open Setup → Business.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const logoUrl = logoPayload?.logoUrl ?? null;
  const busy =
    saveIdentity.isPending ||
    saveLogo.isPending ||
    saveAddress.isPending ||
    saveCurrency.isPending ||
    logoBusy;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Business</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Set your brand, timezone, store address, and display currency.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setGuideOpen((v) => !v)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Guide
            {guideOpen ? (
              <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => reloadFormsFromServer()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Business guide</CardTitle>
            <CardDescription>
              This is the staff home for brand and identity — the logo in the sidebar comes from
              here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-2">
              {GUIDE.map((item) => (
                <li key={item.title} className="space-y-1">
                  <p className="text-foreground font-medium">{item.title}</p>
                  <p className="text-xs leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {!isOwner ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <p className="text-amber-950 dark:text-amber-100">
              Viewing only — organization owners can change name, logo, timezone, and related
              fields.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {profileLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : profileError ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <p className="text-amber-950 dark:text-amber-100">
              Could not load organization profile.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Identity</CardTitle>
                  <CardDescription>
                    Name and details shown to staff
                    {profile?.slug ? ` · ${profile.slug}` : ''}.
                  </CardDescription>
                </div>
                <Building2 className="text-muted-foreground h-5 w-5 shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isOwner) return;
                  saveIdentity.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="biz-name">Business name</Label>
                  <Input
                    id="biz-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isOwner || busy}
                    maxLength={200}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-website">Website</Label>
                  <Input
                    id="biz-website"
                    type="text"
                    inputMode="url"
                    placeholder="https://example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={!isOwner || busy}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-industry">Industry</Label>
                    <Input
                      id="biz-industry"
                      placeholder="Retail, salon, clinic…"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      disabled={!isOwner || busy}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-country">Country</Label>
                    <Input
                      id="biz-country"
                      placeholder="CA, US, GB…"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      disabled={!isOwner || busy}
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-timezone">Timezone</Label>
                  <select
                    id="biz-timezone"
                    className={selectClassName()}
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={!isOwner || busy}
                  >
                    {!timezones.includes(timezone) ? (
                      <option value={timezone}>{timezone}</option>
                    ) : null}
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                {isOwner ? (
                  <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                    {saveIdentity.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Save identity
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Logo</CardTitle>
              <CardDescription>{ORGANIZATION_LOGO_UPLOAD_HINT}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-muted flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URLs / arbitrary tenant logos
                    <img src={logoUrl} alt="Business logo" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="text-muted-foreground h-8 w-8" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Shown in the staff sidebar. Square logos look best.
                  </p>
                  {isOwner ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => void onLogoFile(e.target.files?.[0] ?? null)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {logoBusy || saveLogo.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="mr-2 h-4 w-4" />
                        )}
                        {logoUrl ? 'Replace logo' : 'Upload logo'}
                      </Button>
                      {logoUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => saveLogo.mutate('')}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Store address</CardTitle>
                  <CardDescription>
                    Primary location for your loyalty business
                    {branchesLoading ? '…' : ''}.
                  </CardDescription>
                </div>
                <MapPin className="text-muted-foreground h-5 w-5 shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              {branches.length === 0 && !branchesLoading ? (
                <p className="text-muted-foreground text-sm">
                  No locations yet. A default store is usually created at signup.
                </p>
              ) : (
                <form
                  className="grid gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!isOwner || !canUpdateBranch) return;
                    saveAddress.mutate();
                  }}
                >
                  {branches.length > 1 ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-branch">Location</Label>
                      <select
                        id="biz-branch"
                        className={selectClassName()}
                        value={selectedBranch?.id ?? ''}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!isOwner || busy}
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : selectedBranch ? (
                    <p className="text-muted-foreground text-xs">
                      Editing{' '}
                      <span className="text-foreground font-medium">{selectedBranch.name}</span>
                    </p>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-address">Street address</Label>
                    <Input
                      id="biz-address"
                      placeholder="123 Main St, City"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      disabled={!isOwner || !canUpdateBranch || busy}
                      maxLength={500}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-phone">Store phone</Label>
                    <Input
                      id="biz-phone"
                      type="tel"
                      placeholder="+15550001234"
                      value={branchPhone}
                      onChange={(e) => setBranchPhone(e.target.value)}
                      disabled={!isOwner || !canUpdateBranch || busy}
                    />
                  </div>
                  {isOwner && canUpdateBranch ? (
                    <Button
                      type="submit"
                      disabled={busy || !selectedBranch}
                      className="w-full sm:w-auto"
                    >
                      {saveAddress.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save address
                    </Button>
                  ) : null}
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Display currency</CardTitle>
              <CardDescription>
                Used for stored-value wallets and gift cards. Points naming lives under{' '}
                <Link href="/program" className="text-primary font-medium hover:underline">
                  Program
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isOwner || !canUpdateProgram) return;
                  saveCurrency.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="biz-currency">Currency code</Label>
                  <Input
                    id="biz-currency"
                    list="biz-currency-options"
                    value={displayCurrency}
                    onChange={(e) => setDisplayCurrency(e.target.value.toUpperCase())}
                    disabled={!isOwner || !canUpdateProgram || busy}
                    maxLength={3}
                    placeholder="USD"
                    className="max-w-[8rem] uppercase"
                  />
                  <datalist id="biz-currency-options">
                    {DISPLAY_CURRENCIES.map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                  {program?.pointsCurrencyName ? (
                    <p className="text-muted-foreground text-xs">
                      Points are labeled “{program.pointsCurrencyName}” in Program settings.
                    </p>
                  ) : null}
                </div>
                {isOwner && canUpdateProgram ? (
                  <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                    {saveCurrency.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Save currency
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
