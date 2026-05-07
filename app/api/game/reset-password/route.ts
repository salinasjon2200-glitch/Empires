import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { hashPassword, extractGMToken } from '@/lib/auth';
import { Player } from '@/lib/types';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const { empireName, newPassword } = await req.json();
  if (!empireName || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const players = await dbGet<Player[]>('game:players') ?? [];
  const idx = players.findIndex(p => p.empire.toLowerCase() === empireName.toLowerCase());
  if (idx === -1) return NextResponse.json({ error: 'Empire not found' }, { status: 404 });

  players[idx].passwordHash = await hashPassword(newPassword);
  await dbSet('game:players', players);

  return NextResponse.json({ success: true });
}
