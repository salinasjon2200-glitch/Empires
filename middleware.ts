import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const game = req.nextUrl.searchParams.get('game');

  if (!game || !/^[a-zA-Z0-9_-]{1,64}$/.test(game)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  res.cookies.set('empires-game', game, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
