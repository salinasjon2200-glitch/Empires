import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

// Public list of empires (name, empire, color, status) – no passwords
export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const safe = players.map(({ name, empire, color, status, territories, eliminatedYear }) => ({
    name, empire, color, status, territories, eliminatedYear,
  }));
  return NextResponse.json({ players: safe });
}
