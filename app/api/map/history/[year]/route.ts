import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { TerritoryMap } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { year: string } }) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const year = parseInt(params.year);
  const territories = await dbGet<TerritoryMap>(k(`map:history:${year}`));
  if (!territories) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ territories, year });
}
