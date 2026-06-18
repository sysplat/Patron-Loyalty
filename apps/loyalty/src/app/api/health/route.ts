import { NextResponse } from 'next/server';

/** Lightweight liveness for Railway / load balancers (no upstream API call). */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'loyalty',
    timestamp: new Date().toISOString(),
  });
}
