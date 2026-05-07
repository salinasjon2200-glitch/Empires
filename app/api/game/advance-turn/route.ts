import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { GameState } from '@/lib/types';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const state = await dbGet<GameState>('game:state') ?? {
    phase: 2, currentYear: 2031, theme: 'dark-military',
    biddingOpen: false, turnOpen: false, processingComplete: false,
  } as GameState;

  const newYear = state.currentYear + 1;
  const newState: GameState = {
    ...state,
    currentYear: newYear,
    turnOpen: true,
    processingComplete: false,
  };

  await dbSet('game:state', newState);

  // Track archive
  const archive = await dbGet<number[]>('turn:archive') ?? [];
  if (!archive.includes(newYear)) {
    archive.push(newYear);
    await dbSet('turn:archive', archive);
  }

  return NextResponse.json({ success: true, year: newYear });
}
