import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { year: string } }) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const year = parseInt(params.year);
  if (isNaN(year)) return NextResponse.json({ error: 'Invalid year' }, { status: 400 });

  const summary = await dbGet<{ publicSummary: string; perfectKnowledge?: string }>(k(`turn:${year}:summary`));
  if (!summary) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ publicSummary: summary.publicSummary, year });
}
