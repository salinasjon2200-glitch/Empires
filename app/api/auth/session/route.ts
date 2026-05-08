import { NextRequest, NextResponse } from 'next/server';
import { getSession, extractToken } from '@/lib/auth';
import { dbGet } from '@/lib/db';
import { Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const player = players.find(p => p.name === session.playerName);

  return NextResponse.json({
    ...session,
    status: player?.status ?? 'active',
    territories: player?.territories ?? [],
    eliminatedYear: player?.eliminatedYear,
  });
}
