import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { Player, TerritoryMap } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

// POST – perform random assignment and save
export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { assignments, confirm } = await req.json();
  // assignments: Array<{ playerName: string; empire: string; color: string; country: string }>

  if (!assignments || !Array.isArray(assignments)) {
    return NextResponse.json({ error: 'assignments array required' }, { status: 400 });
  }

  if (!confirm) {
    // Just return preview — don't save
    return NextResponse.json({ ok: true, assignments, confirmed: false });
  }

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const territories: TerritoryMap = {};

  for (const a of assignments) {
    const player = players.find(p => p.name === a.playerName);
    if (!player) continue;
    territories[a.country] = {
      empire: player.empire,
      leader: player.name,
      color: player.color,
      status: 'active',
      since: (await dbGet<{ currentYear: number }>(k('game:state')))?.currentYear ?? 2032,
    };
  }

  await dbSet(k('map:territories'), territories);

  // Update player territory lists
  const updatedPlayers = players.map(p => ({
    ...p,
    territories: assignments
      .filter(a => a.playerName === p.name)
      .map(a => a.country),
  }));
  await dbSet(k('game:players'), updatedPlayers);

  return NextResponse.json({ ok: true, territories, confirmed: true });
}
