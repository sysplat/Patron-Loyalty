import { NextRequest } from 'next/server';
import { refreshFromCookie } from '@/lib/server-auth-bff';

export async function POST(request: NextRequest) {
  return refreshFromCookie(request);
}
