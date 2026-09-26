import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { verifyGMPassword, getSession } from '@/lib/auth';
import { ThemeVote, GameState, Player } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const votes = await dbGet<ThemeVote>('vote:theme') ?? {};
  const tally = { 'dark-military': 0, 'clean-modern': 0 };
  for (const v of Object.values(votes)) tally[v]++;
  return NextResponse.json({ votes, tally });
}

export async function POST(req: NextRequest) {
  const { sessionToken, theme } = await req.json();

  if (!sessionToken || !['dark-military', 'clean-modern'].includes(theme)) {
    return NextResponse.json({ error: 'Invalid vote' }, { status: 400 });
  }

  // Verify the player's actual login session.
  const session = await getSession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  // Verify that the session belongs to a current player.
  const players = await dbGet<Player[]>('game:players') ?? [];
  const player = players.find(p => p.name === session.playerName);

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (player.status !== 'active') {
    return NextResponse.json({ error: 'Eliminated players cannot vote' }, { status: 403 });
  }

  // Votes are keyed by EMPIRE, not player name.
  // This means each empire gets exactly one vote.
  const votes = await dbGet<ThemeVote>('vote:theme') ?? {};
  votes[player.empire] = theme;

  await dbSet('vote:theme', votes);

  return NextResponse.json({
    success: true,
    empire: player.empire,
    theme,
  });
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
