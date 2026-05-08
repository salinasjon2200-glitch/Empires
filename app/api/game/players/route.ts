import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { Player } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Public list of empires (name, empire, color, status) â€” no passwords
export async function GET(_req: NextRequest) {
  const players = await dbGet<Player[]>('game:players') ?? [];
  const safe = players.map(({ name, empire, color, status, territories, eliminatedYear }) => ({
    name, empire, color, status, territories, eliminatedYear,
  }));
  return NextResponse.json({ players: safe });
}
