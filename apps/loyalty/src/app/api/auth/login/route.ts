import { NextRequest } from 'next/server';
import { proxyLogin } from '@/lib/server-auth-bff';

export async function POST(request: NextRequest) {
  return proxyLogin(request, '/auth/login');
}
