import { NextRequest } from 'next/server';

export function getGameId(req: NextRequest): string {
  return req.headers.get('X-Game-ID')
    || req.nextUrl.searchParams.get('game')
    || 's2';
}

// The 's2' game uses unprefixed keys for backward compat with existing Upstash data.
// All other game IDs get a prefix.
export function gk(gameId: string): (key: string) => string {
  return (key: string) => (!gameId || gameId === 's2') ? key : `${gameId}:${key}`;
}
