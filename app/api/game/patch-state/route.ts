import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { GameState } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

// PATCH-style endpoint: merges partial state updates (GM only)
export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const patch = await req.json();
  const current = await dbGet<GameState>(k('game:state')) ?? {} as GameState;
  const updated = { ...current, ...patch };
  await dbSet(k('game:state'), updated);

  return NextResponse.json({ ok: true, state: updated });
}
