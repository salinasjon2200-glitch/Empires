import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
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

export async function POST(req: NextRequest, { params }: { params: { year: string } }) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const year = parseInt(params.year);
  if (isNaN(year)) return NextResponse.json({ error: 'Invalid year' }, { status: 400 });

  const { publicSummary } = await req.json();
  if (typeof publicSummary !== 'string') return NextResponse.json({ error: 'publicSummary required' }, { status: 400 });

  const existing = await dbGet<{ publicSummary: string; perfectKnowledge?: string }>(k(`turn:${year}:summary`)) ?? {};
  await dbSet(k(`turn:${year}:summary`), { ...existing, publicSummary });

  return NextResponse.json({ ok: true, year });
}
