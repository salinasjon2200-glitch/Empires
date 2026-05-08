import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { GameState } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const state = await dbGet<GameState>(k('game:state')) ?? {
    phase: 0, currentYear: 2032, theme: 'dark-military',
    biddingOpen: false, turnOpen: false, processingComplete: false,
  } as GameState;
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  const updates = await req.json();
  const current = await dbGet<GameState>(k('game:state')) ?? {} as GameState;
  await dbSet(k('game:state'), { ...current, ...updates });
  return NextResponse.json({ success: true });
}
