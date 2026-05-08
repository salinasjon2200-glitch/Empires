import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const archive = await dbGet<number[]>(k('turn:archive')) ?? [];
  return NextResponse.json({ archive });
}
