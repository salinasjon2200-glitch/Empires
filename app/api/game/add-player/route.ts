import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';
import { Player, GameState } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { name, empire, password, color } = await req.json();

  if (!name || !empire || !password) {
    return NextResponse.json({ error: 'name, empire, and password are required' }, { status: 400 });
  }

  const players = await dbGet<Player[]>(k('game:players')) ?? [];

  if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: `Player name "${name}" already exists in this game` }, { status: 409 });
  }
  if (players.find(p => p.empire.toLowerCase() === empire.toLowerCase())) {
    return NextResponse.json({ error: `Empire "${empire}" already exists in this game` }, { status: 409 });
  }

  const state = await dbGet<GameState>(k('game:state'));
  const passwordHash = await hashPassword(password);

  const newPlayer: Player = {
    name,
    empire,
    color: color ?? '#6366f1',
    passwordHash,
    status: 'active',
    joinedYear: state?.currentYear ?? 2032,
    territories: [],
  };

  players.push(newPlayer);
  await dbSet(k('game:players'), players);

  return NextResponse.json({ success: true, player: { name, empire, color: newPlayer.color } });
}
