import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { GameState, TurnCodes } from '@/lib/types';

function randomCode(prefix: string): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = prefix.toUpperCase().slice(0, 5) + '-';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// GET — list all codes for current turn (GM only)
export async function GET(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  const state = await dbGet<GameState>('game:state');
  const year = state?.currentYear ?? 2032;
  const codes = await dbGet<TurnCodes>(`turn:${year}:codes`) ?? {};
  return NextResponse.json({ codes, year });
}

// POST — add / reset codes (GM only)
export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const { action, player, code } = await req.json();
  const state = await dbGet<GameState>('game:state');
  const year = state?.currentYear ?? 2032;
  const codes = await dbGet<TurnCodes>(`turn:${year}:codes`) ?? {};

  if (action === 'add') {
    if (!player || !code) return NextResponse.json({ error: 'player and code required' }, { status: 400 });
    codes[code.toUpperCase()] = { used: false, player };
    await dbSet(`turn:${year}:codes`, codes);
    return NextResponse.json({ success: true, codes });
  }

  if (action === 'auto-generate') {
    // Auto-generate for all active players
    const { dbGet: g } = await import('@/lib/db');
    const players = await g<import('@/lib/types').Player[]>('game:players') ?? [];
    for (const p of players.filter(pl => pl.status === 'active')) {
      const c = randomCode(p.name);
      codes[c] = { used: false, player: p.name };
    }
    await dbSet(`turn:${year}:codes`, codes);
    return NextResponse.json({ success: true, codes });
  }

  if (action === 'reset') {
    // Mark all as unused for new turn
    for (const k of Object.keys(codes)) codes[k].used = false;
    await dbSet(`turn:${year}:codes`, codes);
    return NextResponse.json({ success: true, codes });
  }

  if (action === 'delete') {
    if (code && codes[code.toUpperCase()]) {
      delete codes[code.toUpperCase()];
      await dbSet(`turn:${year}:codes`, codes);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
