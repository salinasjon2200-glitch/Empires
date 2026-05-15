import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

// GM-only: get all submitted actions for a specific year
export async function GET(req: NextRequest, { params }: { params: { year: string } }) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const year = parseInt(params.year);
  const actions = await dbGet<Record<string, string>>(k(`turn:${year}:actions`)) ?? {};

  return NextResponse.json({ actions, year });
}
