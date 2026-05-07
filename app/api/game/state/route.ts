import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { GameState } from '@/lib/types';

export async function GET() {
  const state = await dbGet<GameState>('game:state') ?? {
    phase: 0, currentYear: 2032, theme: 'dark-military',
    biddingOpen: false, turnOpen: false, processingComplete: false,
  } as GameState;
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  const updates = await req.json();
  const current = await dbGet<GameState>('game:state') ?? {} as GameState;
  await dbSet('game:state', { ...current, ...updates });
  return NextResponse.json({ success: true });
}
