import { NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { GameInstance } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const index = await dbGet<GameInstance[]>('games:index') ?? [];

  const games = index
    .filter(game => game.status === 'active')
    .map(game => ({
      id: game.id,
      name: game.name,
      startYear: game.startYear,
      contentMode: game.contentMode,
      setupMode: game.setupMode,
    }));

  return NextResponse.json({ games });
}
