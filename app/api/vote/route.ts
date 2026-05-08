import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { verifyGMPassword } from '@/lib/auth';
import { ThemeVote, GameState } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const votes = await dbGet<ThemeVote>('vote:theme') ?? {};
  const tally = { 'dark-military': 0, 'clean-modern': 0 };
  for (const v of Object.values(votes)) tally[v]++;
  return NextResponse.json({ votes, tally });
}

export async function POST(req: NextRequest) {
  const { playerName, theme } = await req.json();
  if (!playerName || !['dark-military', 'clean-modern'].includes(theme)) {
    return NextResponse.json({ error: 'Invalid vote' }, { status: 400 });
  }
  const votes = await dbGet<ThemeVote>('vote:theme') ?? {};
  votes[playerName] = theme;
  await dbSet('vote:theme', votes);
  return NextResponse.json({ success: true });
}

// GM locks the theme and advances to Phase 1
export async function PUT(req: NextRequest) {
  const { gmPassword } = await req.json();
  if (!verifyGMPassword(gmPassword)) {
    return NextResponse.json({ error: 'Invalid GM password' }, { status: 401 });
  }

  const votes = await dbGet<ThemeVote>('vote:theme') ?? {};
  const tally = { 'dark-military': 0, 'clean-modern': 0 };
  for (const v of Object.values(votes)) tally[v]++;
  const winner: 'dark-military' | 'clean-modern' =
    tally['dark-military'] >= tally['clean-modern'] ? 'dark-military' : 'clean-modern';

  const state = await dbGet<GameState>('game:state') ?? {} as GameState;
  await dbSet('game:state', { ...state, theme: winner, phase: 1 });

  return NextResponse.json({ success: true, theme: winner });
}
