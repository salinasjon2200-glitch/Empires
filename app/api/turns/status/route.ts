import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { GameState } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

// GET – returns which players have submitted (not what they submitted). No auth required.
export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const state = await dbGet<GameState>(k('game:state'));
  const year = state?.currentYear ?? 2032;
  const actions = await dbGet<Record<string, string>>(k(`turn:${year}:actions`)) ?? {};

  // Only return the player names who have submitted — not the action text
  const submitted = Object.keys(actions);
  return NextResponse.json({ submitted, year });
}
