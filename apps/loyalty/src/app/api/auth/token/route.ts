import { NextRequest, NextResponse } from 'next/server';
import { WEB_SESSION_COOKIE } from '@queueplatform/shared';

/**
 * Same-origin sync: read HttpOnly session cookie into in-memory client state.
 * Not used for login/session probes — see GET /api/auth/session.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(WEB_SESSION_COOKIE)?.value ?? null;
  if (!accessToken) {
    return NextResponse.json({ message: 'No session' }, { status: 401 });
  }
  return NextResponse.json({ accessToken });
}
