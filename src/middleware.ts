import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const PUBLIC = [
  /^\/login(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/healthz$/,
  /^\/manifest\.webmanifest$/,
  /^\/icon(-.*)?$/,
  /^\/favicon\.ico$/,
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icon).*)'],
};
