'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface LoyaltyProfile {
  birthday?: string | null;
  gender?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}

interface LoyaltyAccount {
  customer: LoyaltyProfile & { id: string };
}

export function PatronLoyaltyProfileForm({ customerId }: { customerId: string }) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const { data: account } = useQuery({
    queryKey: ['loyalty', 'account', customerId],
    queryFn: () => loyaltyGet<LoyaltyAccount>(`/loyalty/accounts/${customerId}`, token!),
    enabled: !!token && !!customerId,
  });

  const customer = account?.customer;
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');

  const save = useMutation({
    mutationFn: () =>
      loyaltyPatch(`/loyalty/accounts/${customerId}/profile`, token!, {
        birthday: birthday || customer?.birthday?.slice(0, 10) || null,
        gender: gender || customer?.gender || null,
        city: city || customer?.city || null,
      }),
    onSuccess: () => {
      toast.success('Loyalty profile updated');
      qc.invalidateQueries({ queryKey: ['loyalty', 'account', customerId] });
    },
    onError: () => toast.error('Could not update profile'),
  });

  if (!customer) return null;

  return (
    <div className="bg-card rounded-xl border p-5">
      <h2 className="mb-3 font-semibold">Loyalty profile</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="date"
          placeholder="Birthday"
          defaultValue={customer.birthday?.slice(0, 10) ?? ''}
          onChange={(e) => setBirthday(e.target.value)}
        />
        <Input
          placeholder={`Gender (${customer.gender ?? 'optional'})`}
          defaultValue={customer.gender ?? ''}
          onChange={(e) => setGender(e.target.value)}
        />
        <Input
          placeholder={`City (${customer.city ?? 'optional'})`}
          defaultValue={customer.city ?? ''}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      <Button size="sm" className="mt-3" onClick={() => save.mutate()} disabled={save.isPending}>
        Save profile
      </Button>
    </div>
  );
}
