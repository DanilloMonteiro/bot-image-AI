import { NextResponse, type NextRequest } from 'next/server';
import { isPublicStoryPath } from './adapters/http/production-traffic-gate';

export function proxy(request: NextRequest): Response {
  if (!isPublicStoryPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: 'not_found' }, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico).*)'],
};
