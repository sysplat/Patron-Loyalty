'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!customer || hydrated) return;
    setBirthday(customer.birthday?.slice(0, 10) ?? '');
    setGender(customer.gender ?? '');
    setCity(customer.city ?? '');
    setHydrated(true);
  }, [customer, hydrated]);

  const save = useMutation({
    mutationFn: () =>
      loyaltyPatch(`/loyalty/accounts/${customerId}/profile`, token!, {
        birthday: birthday || null,
        gender: gender || null,
        city: city || null,
      }),
    onSuccess: () => {
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['loyalty', 'account', customerId] });
    },
    onError: () => toast.error('Could not update profile'),
  });

  if (!customer) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Demographics</CardTitle>
        <CardDescription>Optional fields for segments and birthday campaigns</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-birthday" className="text-muted-foreground text-xs">
            Birthday
          </Label>
          <Input
            id="profile-birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-gender" className="text-muted-foreground text-xs">
            Gender
          </Label>
          <Input
            id="profile-gender"
            placeholder="Optional"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-city" className="text-muted-foreground text-xs">
            City
          </Label>
          <Input
            id="profile-city"
            placeholder="Optional"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save demographics'}
        </Button>
      </CardContent>
    </Card>
  );
}
