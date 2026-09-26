import { NextRequest } from 'next/server';

const DEFAULT_GAME_ID = 's2';

function validGameId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) return null;
  return value;
}

export function getGameId(req: NextRequest): string {
  const headerGame = validGameId(req.headers.get('X-Game-ID'));
  if (headerGame) return headerGame;

  const queryGame = validGameId(req.nextUrl.searchParams.get('game'));
  if (queryGame) return queryGame;

  const cookieGame = validGameId(req.cookies.get('empires-game')?.value);
  if (cookieGame) return cookieGame;

  return DEFAULT_GAME_ID;
}

// The 's2' game uses unprefixed keys for backward compatibility
// with the existing S2 database data.
// Every other game gets its own database namespace.
export function gk(gameId: string): (key: string) => string {
  return (key: string) =>
    (!gameId || gameId === DEFAULT_GAME_ID)
      ? key
      : `${gameId}:${key}`;
}
