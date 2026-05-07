import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { extractGMToken } from '@/lib/auth';
import { Player, GameState } from '@/lib/types';
import { PLAYER_COLORS } from '@/lib/constants';

// POST — register a new player (GM only)
export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const { name, empire, password } = await req.json();
  if (!name || !empire || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const players = await dbGet<Player[]>('game:players') ?? [];
  if (players.find(p => p.empire.toLowerCase() === empire.toLowerCase())) {
    return NextResponse.json({ error: 'Empire already exists' }, { status: 409 });
  }

  const color = PLAYER_COLORS[players.length % PLAYER_COLORS.length];
  const passwordHash = await hashPassword(password);
  const newPlayer: Player = { name, empire, passwordHash, color, status: 'active', territories: [] };
  players.push(newPlayer);
  await dbSet('game:players', players);

  return NextResponse.json({ success: true, color, empire, name });
}

// GET — list all players with passwords visible (GM only)
export async function GET(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }
  const players = await dbGet<Player[]>('game:players') ?? [];
  return NextResponse.json({ players });
}
