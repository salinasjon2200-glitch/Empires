import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { getSession, extractToken } from '@/lib/auth';
import { GameState, TurnCodes } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { turnCode } = await req.json();
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const gameState = await dbGet<GameState>('game:state');
    const year = gameState?.currentYear ?? parseInt(process.env.NEXT_PUBLIC_STARTING_YEAR ?? '2032');

    const codes = await dbGet<TurnCodes>(`turn:${year}:codes`) ?? {};
    const code = codes[turnCode?.toUpperCase()];

    if (!code) return NextResponse.json({ valid: false, error: 'Invalid code' }, { status: 400 });
    if (code.used) return NextResponse.json({ valid: false, error: 'Code already used' }, { status: 400 });
    if (code.player.toLowerCase() !== session.playerName.toLowerCase()) {
      return NextResponse.json({ valid: false, error: 'Code belongs to a different empire' }, { status: 400 });
    }

    // Burn it
    codes[turnCode.toUpperCase()] = { ...code, used: true, usedAt: Date.now() };
    await dbSet(`turn:${year}:codes`, codes);

    return NextResponse.json({ valid: true, burned: true });
  } catch (e) {
    console.error('verify-turn-code error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
