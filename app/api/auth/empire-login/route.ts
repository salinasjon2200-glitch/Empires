import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { Player } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { empireName, password } = await req.json();
    if (!empireName || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const players = await dbGet<Player[]>('game:players') ?? [];
    const player = players.find(p => p.empire.toLowerCase() === empireName.toLowerCase());

    if (!player) {
      return NextResponse.json({ error: 'Empire not found' }, { status: 404 });
    }

    const valid = await verifyPassword(password, player.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid empire password' }, { status: 401 });
    }

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
