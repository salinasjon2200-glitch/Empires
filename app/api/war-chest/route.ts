import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { WarChest, Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const activePlayers = players.filter(p => p.status === 'active');
  const threshold = activePlayers.length * 0.25;

  const chest = await dbGet<WarChest>(k('war:chest')) ?? {
    balance: 0,
    threshold,
    contributions: [],
    lastTurnCost: 0,
    lastUpdated: Date.now(),
  };

  // Always recalculate threshold in case player count changed
  chest.threshold = threshold;

  return NextResponse.json({ warChest: chest });
}

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { amount, contributorName, method } = await req.json();
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const threshold = players.filter(p => p.status === 'active').length * 0.25;

  const chest = await dbGet<WarChest>(k('war:chest')) ?? {
    balance: 0,
    threshold,
    contributions: [],
    lastTurnCost: 0,
    lastUpdated: Date.now(),
  };

  chest.balance = Math.round((chest.balance + Number(amount)) * 100) / 100;
  chest.threshold = threshold;
  chest.contributions.push({
    name: contributorName || 'Anonymous',
    amount: Number(amount),
    method: method ?? 'manual',
    timestamp: Date.now(),
  });
  chest.lastUpdated = Date.now();

  await dbSet(k('war:chest'), chest);
  return NextResponse.json({ ok: true, warChest: chest });
}

// Called after processing to deduct actual API cost
export async function PATCH(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { cost } = await req.json();
  if (cost === undefined) return NextResponse.json({ error: 'cost required' }, { status: 400 });

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const threshold = players.filter(p => p.status === 'active').length * 0.25;

  const chest = await dbGet<WarChest>(k('war:chest')) ?? {
    balance: 0, threshold, contributions: [], lastTurnCost: 0, lastUpdated: Date.now(),
  };

  chest.balance = Math.max(0, Math.round((chest.balance - Number(cost)) * 100) / 100);
  chest.lastTurnCost = Number(cost);
  chest.threshold = threshold;
  chest.lastUpdated = Date.now();

  await dbSet(k('war:chest'), chest);
  return NextResponse.json({ ok: true, warChest: chest });
}
