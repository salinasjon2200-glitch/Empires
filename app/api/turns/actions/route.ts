import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { getSession, extractToken, extractGMToken } from '@/lib/auth';
import { GameState, Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

// GET – GM views all submitted actions
export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  const state = await dbGet<GameState>(k('game:state'));
  const year = state?.currentYear ?? 2032;
  const actions = await dbGet<Record<string, string>>(k(`turn:${year}:actions`)) ?? {};
  return NextResponse.json({ actions, year });
}

// POST – player submits action for current turn
export async function POST(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const player = players.find(p => p.name === session.playerName);
  if (player?.status === 'eliminated') {
    return NextResponse.json({ error: 'Your empire has been eliminated' }, { status: 403 });
  }

  const state = await dbGet<GameState>(k('game:state'));
  const year = state?.currentYear ?? 2032;
  const { action } = await req.json();
  if (!action?.trim()) return NextResponse.json({ error: 'Action cannot be empty' }, { status: 400 });

  const actions = await dbGet<Record<string, string>>(k(`turn:${year}:actions`)) ?? {};
  if (actions[session.playerName]) {
    return NextResponse.json({ error: 'Already submitted this turn' }, { status: 409 });
  }

  actions[session.playerName] = action.trim();
  await dbSet(k(`turn:${year}:actions`), actions);

  return NextResponse.json({ success: true });
}
