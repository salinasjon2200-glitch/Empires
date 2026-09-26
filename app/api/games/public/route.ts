import { NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { GameInstance } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const index = await dbGet<GameInstance[]>('games:index') ?? [];

  const games = index
    .filter(game => game.status === 'active')
    .map(game => ({
      id: game.id,
      name: game.name,
      startYear: game.startYear,
      contentMode: game.contentMode,
      setupMode: game.setupMode,
    }));

  // S2 is the original game and its data uses the legacy, unprefixed
  // database keys. Make sure it is always available to players even if
  // it has not been added to games:index.
  if (!games.some(game => game.id === 's2')) {
    games.unshift({
      id: 's2',
      name: 'S2 — Current Game',
      startYear: 2032,
      contentMode: 'unrestricted',
      setupMode: 'bidding',
    });
  }

  return NextResponse.json({ games });
}
