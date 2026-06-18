'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PRODUCT_SKUS } from '@queueplatform/shared';
import { api } from '@/lib/api';
import { validateRegister } from '@/lib/validation';
import { QlessqBrand } from '@/components/brand';

export default function LoyaltySignupPage() {
  const [form, setForm] = useState({
    organizationName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function updateField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!acceptLegal) {
      setError('You must accept the Terms of Service and Privacy Policy');
      return;
    }

    const validation = validateRegister({
      ...form,
      acceptLegal: true,
      productSku: PRODUCT_SKUS.LOYALTY,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', validation.data, { skipAuth: true });
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'data' in err
          ? String((err as { data?: { message?: string } }).data?.message ?? '')
          : err instanceof Error
            ? err.message
            : 'Registration failed';
      setError(message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-muted/50 flex min-h-screen items-center justify-center px-4">
        <div className="bg-card w-full max-w-md space-y-6 rounded-lg border p-8 text-center shadow-sm">
          <QlessqBrand
            href="/login"
            markSize={52}
            wordmarkHeight={28}
            className="mx-auto"
            priority
          />
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent a verification link to{' '}
            <span className="text-foreground font-medium">{form.email}</span>. After verifying, sign
            in to start building your loyalty program.
          </p>
          <Link
            href="/login"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow transition-colors"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-card w-full max-w-md space-y-8 rounded-lg border p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <QlessqBrand href="/login" markSize={52} wordmarkHeight={28} priority />
          <div>
            <h1 className="text-2xl font-bold">Start Patron Loyalty</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              CRM, points, rewards, and campaigns — no queue management required
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
          )}

          <div className="space-y-2">
            <label htmlFor="orgName" className="text-sm font-medium">
              Business name
            </label>
            <input
              id="orgName"
              type="text"
              value={form.organizationName}
              onChange={(e) => updateField('organizationName', e.target.value)}
              required
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Acme Coffee"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Work email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
              autoComplete="email"
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              required
              autoComplete="new-password"
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptLegal}
              onChange={(e) => setAcceptLegal(e.target.checked)}
              className="mt-1"
            />
            <span className="text-muted-foreground">
              I agree to the{' '}
              <Link href="/terms" className="text-primary hover:underline">
                Patron Loyalty Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Patron Loyalty Privacy Policy
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full rounded-md text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create loyalty account'}
          </button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
