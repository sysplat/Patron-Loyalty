import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@queueplatform/shared';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  if (!accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, data: { accessToken } });
}
