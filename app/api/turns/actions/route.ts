import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { getSession, extractToken, extractGMToken } from '@/lib/auth';
import { GameState, Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

// GET – GM views all submitted actions; player views only their own
export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const state = await dbGet<GameState>(k('game:state'));
  const year = state?.currentYear ?? 2032;
  const actions = await dbGet<Record<string, string>>(k(`turn:${year}:actions`)) ?? {};

  if (extractGMToken(req)) {
    return NextResponse.json({ actions, year });
  }

  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  // Merged leader: return only their own portion
  if (session.isMergedLeader) {
    const leaderActions = await dbGet<Record<string, string>>(k(`turn:${year}:leader-actions:${session.empireName}`)) ?? {};
    return NextResponse.json({ action: leaderActions[session.playerName] ?? null, year });
  }

  return NextResponse.json({ action: actions[session.playerName] ?? null, year });
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
  const empire = players.find(p => p.empire === session.empireName);
  if (empire?.status === 'eliminated') {
    return NextResponse.json({ error: 'Your empire has been eliminated' }, { status: 403 });
  }

  const state = await dbGet<GameState>(k('game:state'));
  const year = state?.currentYear ?? 2032;
  const { action } = await req.json();
  if (!action?.trim()) return NextResponse.json({ error: 'Action cannot be empty' }, { status: 400 });

  const actions = await dbGet<Record<string, string>>(k(`turn:${year}:actions`)) ?? {};

  if (session.isMergedLeader && empire?.isMerged && empire.leaders) {
    // Store per-leader action
    const leaderActions = await dbGet<Record<string, string>>(k(`turn:${year}:leader-actions:${session.empireName}`)) ?? {};
    leaderActions[session.playerName] = action.trim();
    await dbSet(k(`turn:${year}:leader-actions:${session.empireName}`), leaderActions);

    // Rebuild combined action document for this merged empire
    const lines: string[] = [`[MERGED EMPIRE: ${session.empireName}]`, ''];
    for (const leader of empire.leaders) {
      const leaderText = leaderActions[leader.name];
      lines.push(`[${leader.name} — Action Weight: ${leader.weight}/100]`);
      lines.push(leaderText ?? '(not yet submitted)');
      lines.push('');
    }
    lines.push(`NOTE: Where actions contradict, higher-weighted leader's actions take precedence.`);
    const combined = lines.join('\n').trim();

    const isEdit = !!actions[session.empireName];
    actions[session.empireName] = combined;
    await dbSet(k(`turn:${year}:actions`), actions);
    return NextResponse.json({ success: true, updated: isEdit });
  }

  // Normal single-leader empire
  const isEdit = !!actions[session.playerName];
  actions[session.playerName] = action.trim();
  await dbSet(k(`turn:${year}:actions`), actions);
  return NextResponse.json({ success: true, updated: isEdit });
}
