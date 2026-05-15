import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export async function POST(req: NextRequest) {
  try {
    const { empireName, password } = await req.json();
    if (!empireName || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const gameId = getGameId(req);
    const k = gk(gameId);

    const players = await dbGet<Player[]>(k('game:players')) ?? [];
    const player = players.find(p => p.empire.toLowerCase() === empireName.toLowerCase());
    if (!player) return NextResponse.json({ error: 'Empire not found' }, { status: 404 });

    // Merged empire: try each leader's password
    if (player.isMerged && player.leaders?.length) {
      for (const leader of player.leaders) {
        const valid = await verifyPassword(password, leader.passwordHash);
        if (valid) {
          const token = await createSession(leader.name, player.empire, player.color, {
            isMergedLeader: true,
            leaderWeight: leader.weight,
          });
          return NextResponse.json({
            sessionToken: token,
            playerName: leader.name,
            empireName: player.empire,
            color: player.color,
            territories: player.territories,
            status: player.status,
            eliminatedYear: player.eliminatedYear,
            isMergedLeader: true,
            leaderWeight: leader.weight,
            allLeaders: player.leaders.map(l => ({ name: l.name, weight: l.weight })),
          });
        }
      }
      return NextResponse.json({ error: 'Invalid leader password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, player.passwordHash);
    if (!valid) return NextResponse.json({ error: 'Invalid empire password' }, { status: 401 });

    const token = await createSession(player.name, player.empire, player.color);

    return NextResponse.json({
      sessionToken: token,
      playerName: player.name,
      empireName: player.empire,
      color: player.color,
      territories: player.territories,
      status: player.status,
      eliminatedYear: player.eliminatedYear,
    });
  } catch (e) {
    console.error('empire-login error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
